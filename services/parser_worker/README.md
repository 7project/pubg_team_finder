# parser_worker (микросервис)

Фоновый воркер для сбора статистики игроков PUBG через op.gg (или генерации mock-данных) при создании матча.

> Общий README микросервисов: [`../README.md`](../README.md)  
> Главный README проекта: [`../../README.md`](../../README.md)

---

## Содержание

1. [Описание](#описание)
2. [Технологический стек](#технологический-стек)
3. [Структура каталогов](#структура-каталогов)
4. [Архитектура и компоненты](#архитектура-и-компоненты)
5. [Kafka контракт](#kafka-контракт)
6. [Схема Redis](#схема-redis)
7. [Mock-данные](#mock-данные)
8. [Локальный запуск](#локальный-запуск)
9. [Переменные окружения](#переменные-окружения)
10. [Что нужно доработать](#что-нужно-доработать)

---

## Описание

`parser_worker` — это Python-микросервис, который:

1. Подписывается на Kafka топик `match_created`.
2. При получении сообщения извлекает список игроков матча.
3. Для каждого игрока "парсит" статистику с op.gg (сейчас — mock-данные).
4. Кэширует статистику в Redis с TTL 1 час.
5. Сохраняет агрегированную статистику матча в Redis с TTL 5 минут.

**Ключевой принцип:** при любой ошибке (Redis недоступен, op.gg недоступен, неожиданное исключение) сервис **логирует и продолжает работу**, не падая.

**Версия:** MVP / Mock-режим. Реальный парсинг op.gg ещё не реализован.

---

## Технологический стек

| Компонент | Версия | Назначение |
|-----------|--------|------------|
| Python | 3.11 | Runtime |
| aiokafka | 0.10+ | Async Kafka consumer |
| redis (asyncio) | 5.0+ | Async Redis клиент |
| asyncio | stdlib | Event loop |
| logging | stdlib | Структурированные логи |

**Зависимости** устанавливаются прямо в [`Dockerfile`](./Dockerfile):

```dockerfile
RUN pip install --no-cache-dir redis aiokafka asyncio
```

---

## Структура каталогов

```
parser_worker/
├── README.md                       # Этот файл
├── Dockerfile                      # python:3.11-slim + зависимости
└── src/
    └── main.py                     # Точка входа: Kafka consumer + scraper + cache
```

Все классы реализованы в одном файле [`src/main.py`](./src/main.py):

| Класс | Строки | Назначение |
|-------|--------|------------|
| `RedisCache` | `31-52` | Обёртка над `redis.asyncio` с `get/set/close` |
| `OpggScraper` | `55-93` | Получение статистики с кэшированием |
| `KafkaConsumer` | `96-133` | Универсальный consumer + producer |
| `handle_match_created` | `136-147` | Handler топика `match_created` |
| `main` | `150-161` | Bootstrap: cache → scraper → consumer |

---

## Архитектура и компоненты

### Поток обработки сообщения

```
┌─────────────────┐
│  Kafka topic    │
│  match_created  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  KafkaConsumer  │
│  (group:        │
│  parser_worker) │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────┐
│  handle_match_created        │
│  1. Извлечь match_id,        │
│     players                   │
│  2. Вызвать                  │
│     scraper.scrape_match_     │
│     players(match_id, ...)    │
└────────┬─────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│  OpggScraper                       │
│  for each player:                  │
│    1. cache.get(player_stats:p1)   │
│    2. if hit → return cached       │
│    3. else: scrape_opgg(p1)        │
│    4. cache.set(ttl=3600)          │
│  match_data = {match_id, players}  │
│  cache.set(match_stats:{id},       │
│            ttl=300)                 │
└────────────────────────────────────┘
```

### Жизненный цикл

```python
# src/main.py
async def main():
    cache = RedisCache(REDIS_URL)         # 1. Подключение к Redis
    scraper = OpggScraper(cache)          # 2. Инициализация scraper'а
    consumer = KafkaConsumer(             # 3. Создание consumer'а
        topics=["match_created"],
        group_id="parser_worker"
    )
    await consumer.start(handle_match_created)  # 4. Бесконечный цикл
```

`scraper` объявлен как `global` (вне `main()`), чтобы handler мог к нему обращаться.

---

## Kafka контракт

### Топик: `match_created`

**Producer:** backend ([`backend/app/services/match_service.py`](../../backend/app/services/match_service.py))

**Consumer group:** `parser_worker`

**Формат сообщения:**

```json
{
  "match_id": "uuid-string",
  "players": [
    {
      "player_id": "uuid-string",
      "username": "player_nickname"
    }
  ]
}
```

### Обработка ошибок

```python
# src/main.py
async for msg in self.consumer:
    try:
        logger.info(f"Received: topic={msg.topic} key={msg.key}")
        await handler(msg.topic, msg.value)
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        # Цикл НЕ прерывается, обработка следующего сообщения
```

**Невалидное сообщение** (нет `match_id` или `players`):

```python
async def handle_match_created(topic: str, data: dict):
    match_id = data.get("match_id")
    players = data.get("players", [])

    if not match_id or not players:
        logger.warning(f"Invalid match_created message: {data}")
        return  # Skip, don't fail
```

---

## Схема Redis

| Ключ | Тип | TTL | Описание |
|------|-----|-----|----------|
| `player_stats:{player_id}` | JSON string | 3600s (1h) | Статистика одного игрока |
| `match_stats:{match_id}` | JSON string | 300s (5m) | Агрегированная статистика матча |

### Структура JSON

```json
// player_stats:{player_id}
{
  "rank": "Diamond",
  "rank_tier": "Diamond IV",
  "kda": 3.5,
  "win_rate": 52.3,
  "games_played": 150,
  "kills": 2500,
  "deaths": 714,
  "assists": 1200,
  "top_ratio": 15.2,
  "avg_damage": 280.5,
  "username": "player_nickname",
  "player_id": "uuid-string",
  "last_updated": "2024-XX-XXTXX:XX:XX.XXXXXX"
}

// match_stats:{match_id}
{
  "match_id": "uuid-string",
  "players": [ /* массив player_stats */ ],
  "scraped_at": "2024-XX-XXTXX:XX:XX.XXXXXX"
}
```

### Кэш-промах

При `cache.get()` возвращает `None`, если ключ не существует или Redis недоступен (с try/except). В обоих случаях scraper вызывает `scrape_player_stats()`.

---

## Mock-данные

> Реальный парсер op.gg **не реализован**. Используются фиктивные данные для разработки и тестирования.

```python
MOCK_STATS = {
    "rank": "Diamond",
    "rank_tier": "Diamond IV",
    "kda": 3.5,
    "win_rate": 52.3,
    "games_played": 150,
    "kills": 2500,
    "deaths": 714,
    "assists": 1200,
    "top_ratio": 15.2,
    "avg_damage": 280.5,
    "last_updated": datetime.now().isoformat()
}
```

**Имитация задержки:**

```python
await asyncio.sleep(1)  # Симуляция HTTP-запроса к op.gg
```

Это позволяет увидеть поведение кэша в реальном времени.

**Замена на реальный парсер** потребует:

1. HTTP-клиент (httpx) с `User-Agent` и rate limiting.
2. HTML-парсинг (BeautifulSoup, selectolax).
3. Обработку блокировок (CAPTCHA, 403, 429).
4. Per-player rate limit (1 req/3s) чтобы не забанили.

---

## Локальный запуск

### Через Docker Compose (рекомендуется)

```bash
cd ../../infrastructure
docker compose up -d parser_worker
docker compose logs -f parser_worker
```

### Локально без Docker

Требуется: Python 3.11, Redis (доступный), Kafka (доступный).

```bash
cd services/parser_worker
pip install redis aiokafka asyncio

export REDIS_URL=redis://localhost:6379/0
export KAFKA_BOOTSTRAP_SERVERS=localhost:9092

python -m src.main
```

### Тестирование вручную

Отправить тестовое сообщение в Kafka:

```python
import asyncio, json
from aiokafka import AIOKafkaProducer

async def send():
    producer = AIOKafkaProducer(
        bootstrap_servers="localhost:9092",
        value_serializer=lambda v: json.dumps(v).encode()
    )
    await producer.start()
    try:
        await producer.send_and_wait("match_created", {
            "match_id": "test-match-001",
            "players": [
                {"player_id": "p1", "username": "SouthUralPLAY"},
                {"player_id": "p2", "username": "ProGamerTOP"}
            ]
        })
    finally:
        await producer.stop()

asyncio.run(send())
```

Проверить кэш:

```bash
redis-cli KEYS 'player_stats:*'
redis-cli KEYS 'match_stats:*'
redis-cli GET 'player_stats:p1'
```

---

## Переменные окружения

| Переменная | Обязательна | По умолчанию | Описание |
|------------|-------------|--------------|----------|
| `REDIS_URL` | ✅ | `redis://redis:6379/0` | URL Redis |
| `KAFKA_BOOTSTRAP_SERVERS` | ✅ | `kafka:9092` | Kafka bootstrap |
| `CACHE_TTL` (hardcoded) | ❌ | `3600` | TTL для статистики игрока (в коде) |
| `MATCH_CACHE_TTL` (hardcoded) | ❌ | `300` | TTL для статистики матча (в коде) |

> ⚠️ `CACHE_TTL` и `MATCH_CACHE_TTL` захардкожены в коде. Нужно вынести в ENV (см. TODO).

---

## Производительность

- **Sequential processing:** `scrape_match_players` обрабатывает игроков последовательно (`for player_id, username in player_ids`).
- **Имитация задержки:** 1 секунда на "запрос" к op.gg.
- **Кэш-хит:** ~0ms.
- **Кэш-промах:** ~1000ms (mock).

Для матча с 4 игроками (SQUAD):
- Все в кэше: <100ms
- Все промахи: ~4 секунды

**Оптимизация:** использовать `asyncio.gather()` для параллельного запроса (см. TODO).

---

## Известные багфиксы

> Нет открытых багов. Сервис спроектирован с graceful degradation с самого начала.

---

## Что нужно доработать

- [ ] **Real op.gg парсер** — заменить `MOCK_STATS` на реальные HTTP-запросы (httpx + BeautifulSoup).
- [ ] **Rate limiting** при парсинге op.gg (1 req/3s, sliding window).
- [ ] **CAPTCHA handling** — fallback на мок при 403/429.
- [ ] **Параллельная обработка** игроков — `asyncio.gather()` в `scrape_match_players`.
- [ ] **Unit-тесты:**
  - [ ] `RedisCache.get/set` с mock redis
  - [ ] `OpggScraper.scrape_player_stats` с кэш-хитом и промахом
  - [ ] `KafkaConsumer` с mock consumer
  - [ ] `handle_match_created` с валидным/невалидным сообщением
- [ ] **Интеграционные тесты** с testcontainers (real Redis + real Kafka).
- [ ] **Вынести TTL в ENV** (`CACHE_TTL`, `MATCH_CACHE_TTL`).
- [ ] **Метрики** — `prometheus_client`:
  - `parser_requests_total{status="hit|miss|error"}`
  - `parser_cache_size_bytes`
  - `parser_scrape_duration_seconds`
- [ ] **Healthcheck endpoint** — для k8s probes (добавить aiohttp + `/healthz`).
- [ ] **JSON Schema валидация** входящих сообщений.
- [ ] **Dead Letter Queue** — невалидные сообщения в `match_created_dlq`.
- [ ] **Структурированные логи** (JSON) для ELK/Loki.
- [ ] **OpenTelemetry** — distributed tracing (trace_id из Kafka header).
- [ ] **Graceful shutdown** — обработка SIGTERM, завершение текущего сообщения.
- [ ] **Retry policy** для временных ошибок Redis.
- [ ] **Persistent metrics** — Prometheus pushgateway для короткоживущих воркеров.
- [ ] **Configuration через Pydantic Settings** (вместо `os.getenv`).
- [ ] **Type hints** — добавить везде, проверить mypy --strict.
- [ ] **Докеризация** — multi-stage build, non-root user, read-only filesystem.
- [ ] **Helm chart** для k8s деплоя.
- [ ] **CI/CD** — отдельный пайплайн: lint (ruff) + test (pytest) + build image.

---

## Полезные ссылки

- [OpggScraper (исходник)](./src/main.py#L55-L93)
- [Kafka handler (исходник)](./src/main.py#L136-L147)
- [Mock-данные (исходник)](./src/main.py#L17-L29)
- [RedisCache (исходник)](./src/main.py#L31-L52)
- [Backend, отправляющий match_created](../../backend/app/services/match_service.py)
- [Docker-конфигурация](../../infrastructure/docker-compose.yml)
