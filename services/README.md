# Services (Микросервисы)

Коллекция **микросервисов** для **PUBG Team Finder**: фоновые обработчики событий из Kafka.

> Главный README проекта: [`../README.md`](../README.md)

---

## Содержание

1. [Описание](#описание)
2. [Философия: Graceful Degradation](#философия-graceful-degradation)
3. [Список микросервисов](#список-микросервисов)
4. [Kafka топики и контракты](#kafka-топики-и-контракты)
5. [Структура каталогов](#структура-каталогов)
6. [Запуск](#запуск)
7. [Переменные окружения](#переменные-окружения)
8. [Что нужно доработать](#что-нужно-доработать)

---

## Описание

Папка `services/` содержит **независимые Python-микросервисы**, которые запускаются в отдельных контейнерах и общаются с backend через **Apache Kafka**. Они не имеют прямого доступа к PostgreSQL и не предоставляют HTTP API.

Каждый сервис:

1. Подписывается на **один или несколько Kafka топиков**.
2. Обрабатывает сообщения асинхронно.
3. **Никогда не падает** — при любой ошибке логирует и продолжает работу.
4. Идемпотентен — может безопасно перечитывать сообщения.

Все сервисы разворачиваются через `infrastructure/docker-compose.yml` (см. [`../infrastructure/README.md`](../infrastructure/README.md)).

---

## Философия: Graceful Degradation

Главный принцип — **сервис не должен ломать основной поток** backend'а, даже если внешние зависимости (Discord API, op.gg, Redis) недоступны.

### Паттерн обработки ошибок

```python
try:
    result = await external_api.call(...)
except ExternalApiError as e:
    logger.warning(f"External API failed: {e}")
    result = MOCK_FALLBACK  # Возвращаем заглушку, не падаем
```

### Примеры

| Сценарий | Реакция сервиса |
|----------|-----------------|
| Redis недоступен | Кэш возвращает `None`, запрос идёт к внешнему API |
| Kafka недоступен | Сервис логирует warning и реконнектится (не падает) |
| Discord API недоступен | Возвращается `MOCK_CHANNEL_ID` + лог |
| op.gg недоступен | Возвращается `MOCK_STATS` (см. ниже) |
| Неожиданное исключение в handler | Логируется, цикл consumer'а продолжается |

---

## Список микросервисов

| Сервис | Порт | Kafka топики | Внешние зависимости | Документация |
|--------|------|--------------|---------------------|--------------|
| `parser_worker` | — | `match_created` | Redis, op.gg (mock) | [`parser_worker/README.md`](./parser_worker/README.md) |
| `discord_bot` | — | `match_created`, `match_completed` | Discord API | [`discord_bot/README.md`](./discord_bot/README.md) |

### parser_worker

**Назначение:** сбор статистики игроков с op.gg (или генерация mock-данных) при создании матча.

**Контракт сообщения:**

```json
{
  "match_id": "uuid",
  "players": [
    {"player_id": "uuid", "username": "player1"}
  ]
}
```

**Что делает:**

1. Получает сообщение `match_created`.
2. Для каждого игрока вызывает `scrape_player_stats()`.
3. Кэширует результат в Redis (TTL 3600s).
4. Сохраняет агрегированную статистику матча в Redis (TTL 300s).

Подробности: [`./parser_worker/README.md`](./parser_worker/README.md).

### discord_bot

**Назначение:** создание и удаление голосовых каналов в Discord для матчей.

**Контракт сообщений:**

```json
// match_created → создать канал
{ "match_id": "uuid", "match_name": "Match ABC12345" }

// match_completed → удалить канал
{ "match_id": "uuid" }
```

**Что делает:**

1. `match_created` → `create_match_channel()` → возвращает `channel_id` (реальный или `MOCK_CHANNEL_ID`).
2. `match_completed` → `delete_match_channel()` → удаляет канал из `active_channels`.

Подробности: [`./discord_bot/README.md`](./discord_bot/README.md).

---

## Kafka топики и контракты

### Топики

| Топик | Producer | Consumers | Payload |
|-------|----------|-----------|---------|
| `match_created` | backend (`match_service.create_match`) | parser_worker, discord_bot | `MatchCreated` (см. ниже) |
| `match_completed` | backend (`match_service.complete_match`) | discord_bot | `MatchCompleted` (см. ниже) |
| `match_invite` | backend | (планируется) | `MatchInvite` |
| `invite_accepted` | backend | (планируется) | `InviteAccepted` |
| `match_left` | backend | (планируется) | `MatchLeft` |
| `player_stats` | parser_worker | backend (кэш инвалидация) | `PlayerStats` |

> ⚠️ Producer/consumer group настраивается на стороне сервиса. Сейчас все сервисы используют `auto_offset_reset='earliest'`.

### Схемы сообщений

```json
// MatchCreated
{
  "match_id": "uuid",
  "created_by": "uuid",
  "match_type": "SQUAD" | "DUO" | "CUSTOM",
  "max_players": 4,
  "players": [
    {"player_id": "uuid", "username": "string"}
  ]
}

// MatchCompleted
{ "match_id": "uuid" }
```

---

## Структура каталогов

```
services/
├── README.md                          # Этот файл
│
├── parser_worker/
│   ├── README.md                      # Документация сервиса
│   ├── Dockerfile                     # python:3.11-slim
│   └── src/
│       └── main.py                    # Kafka consumer + scraper + cache
│
└── discord_bot/
    ├── README.md                      # Документация сервиса
    ├── Dockerfile                     # python:3.11-slim
    └── src/
        └── main.py                    # Discord.py + Kafka consumer
```

---

## Запуск

### В составе полного стека (рекомендуется)

```bash
cd infrastructure
docker compose up -d
# parser_worker и discord_bot стартуют автоматически
```

### Только микросервисы (если backend уже запущен)

```bash
docker compose up -d parser_worker discord_bot
```

### Локальная разработка (без Docker)

```bash
# parser_worker
cd services/parser_worker
pip install redis aiokafka asyncio
REDIS_URL=redis://localhost:6379/0 \
KAFKA_BOOTSTRAP_SERVERS=localhost:9092 \
python -m src.main

# discord_bot (в другом терминале)
cd services/discord_bot
pip install discord.py aiokafka asyncio
DISCORD_BOT_TOKEN=your_token \
DISCORD_GUILD_ID=your_guild \
DISCORD_CATEGORY_ID=your_category \
KAFKA_BOOTSTRAP_SERVERS=localhost:9092 \
python -m src.main
```

### Логи

```bash
docker compose logs -f parser_worker
docker compose logs -f discord_bot
```

---

## Переменные окружения

### Общие (оба сервиса)

| Переменная | Описание |
|------------|----------|
| `KAFKA_BOOTSTRAP_SERVERS` | Адрес Kafka (например, `kafka:9092` в Docker, `localhost:9092` локально) |

### parser_worker

| Переменная | Описание |
|------------|----------|
| `REDIS_URL` | URL Redis для кэша (TTL 1h для статистики, 5m для матча) |

### discord_bot

| Переменная | Описание |
|------------|----------|
| `DISCORD_BOT_TOKEN` | Токен бота (если пусто — mock-режим) |
| `DISCORD_GUILD_ID` | ID сервера Discord |
| `DISCORD_CATEGORY_ID` | ID категории для новых каналов |

---

## Отладка

### Проверка топиков Kafka

```bash
# Войти в контейнер kafka
docker compose exec kafka bash

# Посмотреть топики
kafka-topics --bootstrap-server localhost:9092 --list

# Прочитать сообщения
kafka-console-consumer --bootstrap-server localhost:9092 \
  --topic match_created --from-beginning --max-messages 5
```

### Тестовое сообщение (через Python)

```python
import asyncio, json
from aiokafka import AIOKafkaProducer

async def send():
    producer = AIOKafkaProducer(bootstrap_servers="kafka:9092",
        value_serializer=lambda v: json.dumps(v).encode())
    await producer.start()
    await producer.send_and_wait("match_created", {
        "match_id": "test-uuid",
        "match_type": "SQUAD",
        "max_players": 4,
        "players": [{"player_id": "p1", "username": "tester"}]
    })
    await producer.stop()

asyncio.run(send())
```

---

## Что нужно доработать

- [ ] **Unit-тесты** для `parser_worker`: mock Redis, mock Kafka, mock op.gg responses.
- [ ] **Unit-тесты** для `discord_bot`: mock discord.py client, mock Kafka.
- [ ] **Интеграционные тесты** с testcontainers.
- [ ] **Real op.gg интеграция** — заменить mock на реальный парсинг с rate limiting (1 req/sec).
- [ ] **Real Discord API** — в `discord_bot` уже есть try/except, но нужно покрыть edge cases (rate limits, удаление каналов при рестарте).
- [ ] **Персистентность `active_channels`** в `discord_bot` — сейчас теряется при рестарте (нужен Redis).
- [ ] **Метрики** — `prometheus_client` для parser_worker (количество запросов, кэш-хиты, ошибки).
- [ ] **Dead Letter Queue** — при невалидном сообщении отправлять в `*_dlq` топик.
- [ ] **Версионирование контрактов** — JSON Schema валидация входящих сообщений.
- [ ] **Структурированные логи** — JSON-формат для ELK/Loki.
- [ ] **Healthcheck endpoint** — для k8s liveness/readiness probes (но у сервисов нет HTTP).
- [ ] **Graceful shutdown** — обработка SIGTERM с завершением текущего сообщения.
- [ ] **Retry policy** — для временных ошибок (сеть, БД) с exponential backoff.
- [ ] **Traces** — OpenTelemetry для распределённой трассировки (backend → kafka → worker).
- [ ] **CI/CD** — отдельные пайплайны для каждого микросервиса.
- [ ] **Helm charts** / k8s manifests для деплоя вне docker-compose.
- [ ] **Множественные инстансы** — горизонтальное масштабирование (сейчас 1 реплика каждого).

---

## Дополнительные ссылки

- Kafka топики проекта: см. раздел [Kafka топики и контракты](#kafka-топики-и-контракты) выше
- Docker-конфигурация: [`../infrastructure/README.md`](../infrastructure/README.md)
- Backend API: [`../backend/README.md`](../backend/README.md)
