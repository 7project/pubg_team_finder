# discord_bot (микросервис)

Фоновый воркер для создания и удаления **голосовых каналов Discord** при создании и завершении матчей.

> Общий README микросервисов: [`../README.md`](../README.md)  
> Главный README проекта: [`../../README.md`](../../README.md)

---

## Содержание

1. [Описание](#описание)
2. [Технологический стек](#технологический-стек)
3. [Структура каталогов](#структура-каталогов)
4. [Архитектура и компоненты](#архитектура-и-компоненты)
5. [Kafka контракт](#kafka-контракт)
6. [Discord API взаимодействие](#discord-api-взаимодействие)
7. [Graceful Degradation](#graceful-degradation)
8. [Локальный запуск](#локальный-запуск)
9. [Настройка Discord](#настройка-discord)
10. [Переменные окружения](#переменные-окружения)
11. [Что нужно доработать](#что-нужно-доработать)

---

## Описание

`discord_bot` — это Python-микросервис, который:

1. Подписывается на Kafka топики `match_created` и `match_completed`.
2. При `match_created` создаёт **голосовой канал** в Discord для матча.
3. При `match_completed` **удаляет** канал.
4. Хранит `match_id → channel_id` в памяти процесса (`active_channels`).

**Ключевой принцип:** если Discord API недоступен или бот не авторизован — сервис возвращает `MOCK_CHANNEL_ID` и **логирует warning**, не падая. Это позволяет всему pipeline работать в dev-режиме без реального Discord.

**Версия:** MVP. Только создание/удаление голосовых каналов. Текстовые каналы, роли, эмодзи — не реализованы.

---

## Технологический стек

| Компонент | Версия | Назначение |
|-----------|--------|------------|
| Python | 3.11 | Runtime |
| discord.py | 2.x | Async обёртка над Discord API |
| aiokafka | 0.10+ | Async Kafka consumer |
| asyncio | stdlib | Event loop |
| logging | stdlib | Структурированные логи |

**Зависимости** устанавливаются прямо в [`Dockerfile`](./Dockerfile):

```dockerfile
RUN pip install --no-cache-dir discord.py aiokafka asyncio
```

---

## Структура каталогов

```
discord_bot/
├── README.md                       # Этот файл
├── Dockerfile                      # python:3.11-slim + зависимости
└── src/
    └── main.py                     # Точка входа: Discord client + Kafka consumer
```

Все классы реализованы в одном файле [`src/main.py`](./src/main.py):

| Класс / Функция | Строки | Назначение |
|-----------------|--------|------------|
| `DiscordBot` | `21-89` | Обёртка над discord.Client, методы create/delete channel |
| `KafkaConsumer` | `92-117` | Async consumer с обработчиком ошибок |
| `handle_match_created` | `120-126` | Handler для создания канала |
| `handle_match_completed` | `129-135` | Handler для удаления канала |
| `main` | `138-160` | Bootstrap: bot → consumer |
| `MOCK_CHANNEL_ID` | `18` | Заглушка ID канала |

---

## Архитектура и компоненты

### Поток обработки матча

```
┌──────────────────────┐
│ Backend (FastAPI)    │
│ POST /api/v1/matches │
└──────────┬───────────┘
           │ Создание Match в БД
           ▼
┌──────────────────────┐
│  Kafka topic         │
│  match_created       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────┐
│  KafkaConsumer           │
│  (group: discord_bot)    │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  handle_match_created            │
│  → bot.create_match_channel(     │
│      match_id, match_name)        │
│  → сохраняет в active_channels   │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────┐
│  Discord API            │
│  POST /guilds/{id}/     │
│      channels           │
│  → возвращает channel_id│
└──────────────────────────┘


           ... (через несколько минут) ...


┌──────────────────────┐
│  Kafka topic         │
│  match_completed     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────┐
│  handle_match_completed          │
│  → bot.delete_match_channel(     │
│      match_id)                   │
│  → удаляет из active_channels   │
└──────────────────────────────────┘
```

### Структура `DiscordBot`

```python
class DiscordBot:
    def __init__(self, token, guild_id, category_id):
        self.token = token
        self.guild_id = guild_id
        self.category_id = category_id
        self.client: discord.Client | None = None
        self.active_channels: dict[str, int] = {}  # match_id → channel_id
```

**`active_channels`** — простой in-memory dict. **Теряется при рестарте** (см. TODO: персистентность в Redis).

---

## Kafka контракт

### Топики

| Топик | Действие |
|-------|----------|
| `match_created` | Создать голосовой канал |
| `match_completed` | Удалить голосовой канал |

**Consumer group:** `discord_bot`

### Формат сообщений

```json
// match_created
{
  "match_id": "uuid-string",
  "match_name": "Match ABC12345"  // опционально, по умолчанию "Match {match_id[:8]}"
}

// match_completed
{
  "match_id": "uuid-string"
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
        # Цикл НЕ прерывается
```

---

## Discord API взаимодействие

### Создание канала

```python
async def create_match_channel(self, match_id, match_name=None) -> str:
    if not self.client or not self.client.is_ready():
        logger.warning("Discord client not ready, returning mock channel ID")
        return MOCK_CHANNEL_ID

    try:
        guild = self.client.get_guild(int(self.guild_id))
        if not guild:
            logger.warning(f"Guild {self.guild_id} not found")
            return MOCK_CHANNEL_ID

        category = guild.get_channel(int(self.category_id)) if self.category_id else None
        channel_name = match_name or f"Match {match_id[:8]}"
        channel = await guild.create_voice_channel(channel_name, category=category)

        self.active_channels[match_id] = channel.id
        logger.info(f"Created channel {channel.name} ({channel.id}) for match {match_id}")
        return str(channel.id)

    except discord.DiscordException as e:
        logger.error(f"Discord API error creating channel: {e}")
        return MOCK_CHANNEL_ID
```

**Возвращаемое значение:**

- Реальный `channel_id` (snowflake) — при успехе.
- `MOCK_CHANNEL_ID = "1234567890"` — при любой ошибке.

### Удаление канала

```python
async def delete_match_channel(self, match_id) -> bool:
    channel_id = self.active_channels.get(match_id)
    if not channel_id:
        logger.warning(f"No active channel found for match {match_id}")
        return False
    # ... try/except + DiscordException handling
```

**Возвращаемое значение:** `True` при успехе, `False` если канал не найден или ошибка.

---

## Graceful Degradation

| Сценарий | Реакция |
|----------|---------|
| `DISCORD_BOT_TOKEN` пустой | Mock-режим: `MOCK_CHANNEL_ID` всегда |
| `DISCORD_BOT_TOKEN == "your_bot_token_here"` | Mock-режим (проверка в `main()`) |
| Discord API таймаут | `MOCK_CHANNEL_ID` + warning в лог |
| Guild не найден | `MOCK_CHANNEL_ID` + warning |
| `discord.DiscordException` | `MOCK_CHANNEL_ID` + error в лог |
| Клиент не готов (`is_ready() == False`) | `MOCK_CHANNEL_ID` + warning |

**В `main()`** явно проверяется валидность токена:

```python
if DISCORD_BOT_TOKEN and DISCORD_BOT_TOKEN != "your_bot_token_here":
    asyncio.create_task(bot.start())  # Реальный клиент
    await asyncio.sleep(5)            # Ждём подключения
else:
    logger.info("Running in mock mode (no Discord token)")
```

---

## Локальный запуск

### Через Docker Compose (рекомендуется)

```bash
cd ../../infrastructure
docker compose up -d discord_bot
docker compose logs -f discord_bot
```

### Локально без Docker

Требуется: Python 3.11, Kafka (доступный), валидный Discord bot token.

```bash
cd services/discord_bot
pip install discord.py aiokafka asyncio

export DISCORD_BOT_TOKEN=your_real_token
export DISCORD_GUILD_ID=123456789012345678
export DISCORD_CATEGORY_ID=123456789012345678
export KAFKA_BOOTSTRAP_SERVERS=localhost:9092

python -m src.main
```

### Тестовое сообщение

Отправить `match_created` в Kafka:

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
            "match_id": "test-match-123",
            "match_name": "Test Match"
        })
    finally:
        await producer.stop()

asyncio.run(send())
```

Через 5 секунд в Discord должен появиться канал "Test Match".

---

## Настройка Discord

### 1. Создать Discord Application

1. Перейти на https://discord.com/developers/applications.
2. **New Application** → дать имя → **Bot** → **Add Bot**.
3. Скопировать **Token** → `DISCORD_BOT_TOKEN`.

### 2. Пригласить бота на сервер

1. **OAuth2 → URL Generator**.
2. Scopes: `bot`.
3. Bot Permissions:
   - `Manage Channels` (создание/удаление)
   - `Connect` (голосовые каналы)
   - `Move Members` (опционально)
4. Скопировать URL, открыть в браузере, выбрать сервер.

### 3. Получить Guild ID и Category ID

1. **Guild ID:** ПКМ по серверу → "Copy Server ID" (нужен Developer Mode).
2. **Category ID:** Создать категорию "PUBG Matches" → ПКМ → "Copy Channel ID".

### 4. Заполнить `.env`

```env
DISCORD_BOT_TOKEN=OTk4NjU0MzIxNDg0NTY3OTAw.GaBcDe.FgHiJkLmNoPqRsTuVwXyZ...
DISCORD_GUILD_ID=123456789012345678
DISCORD_CATEGORY_ID=987654321098765432
```

---

## Переменные окружения

| Переменная | Обязательна | По умолчанию | Описание |
|------------|-------------|--------------|----------|
| `DISCORD_BOT_TOKEN` | ❌ (mock если пусто) | `""` | Токен Discord-бота |
| `DISCORD_GUILD_ID` | ❌ | `""` | ID сервера Discord |
| `DISCORD_CATEGORY_ID` | ❌ | `""` | ID категории для каналов |
| `KAFKA_BOOTSTRAP_SERVERS` | ✅ | `kafka:9092` | Kafka bootstrap |

> Если `DISCORD_BOT_TOKEN` пуст или равен `"your_bot_token_here"`, сервис работает в mock-режиме.

---

## Известные ограничения

1. **In-memory storage** — `active_channels` теряется при рестарте контейнера. Уже завершённые матчи оставят каналы в Discord.
2. **Нет rate limit handling** — при массовом создании каналов Discord может вернуть 429.
3. **Один инстанс** — горизонтальное масштабирование приведёт к дублям (несколько ботов на одном сервере).
4. **Нет cleanup** при рестарте — старые каналы остаются в Discord.
5. **Mock-режим для всех ошибок** — даже если ошибка транзиентная, возвращается mock (нужно различать recoverable/non-recoverable).

---

## Что нужно доработать

- [ ] **Персистентность `active_channels`** в Redis (ключ `discord:active_channels`, hash `match_id → channel_id`).
- [ ] **Cleanup при старте** — загружать из Redis и опционально удалять осиротевшие каналы.
- [ ] **Unit-тесты:**
  - [ ] `DiscordBot.create_match_channel` с mock client
  - [ ] `DiscordBot.delete_match_channel` с пустым/непустым `active_channels`
  - [ ] `handle_match_created` / `handle_match_completed`
  - [ ] Mock-режим при пустом токене
- [ ] **Интеграционные тесты** с testcontainers Kafka + реальный discord.py mock-сервер.
- [ ] **Rate limit handling** — обработка 429 с retry-after.
- [ ] **Idempotency** — если `create_match_channel` вызван дважды, не создавать второй канал.
- [ ] **Текстовые каналы** — создавать парой voice + text для чата матча.
- [ ] **Роли матча** — создавать/удалять `@Match-{id}` роль для участников.
- [ ] **Permissions** — настраивать права доступа к каналу (только участники матча).
- [ ] **Webhook уведомления** — приглашать участников через webhook.
- [ ] **JSON Schema валидация** входящих сообщений.
- [ ] **Dead Letter Queue** — невалидные сообщения в `*_dlq` топик.
- [ ] **Метрики** — `prometheus_client`:
  - `discord_channels_created_total`
  - `discord_channels_deleted_total`
  - `discord_api_errors_total{type=...}`
  - `discord_client_ready` (gauge)
- [ ] **Healthcheck endpoint** — для k8s probes.
- [ ] **Структурированные логи** (JSON).
- [ ] **OpenTelemetry** — distributed tracing.
- [ ] **Graceful shutdown** — обработка SIGTERM (закрыть Kafka consumer, остановить discord client).
- [ ] **Configuration через Pydantic Settings** (вместо `os.getenv`).
- [ ] **Type hints** + `mypy --strict`.
- [ ] **Pre-commit hooks** — black, isort, ruff.
- [ ] **Докеризация** — multi-stage build, non-root user, read-only filesystem.
- [ ] **Helm chart** для k8s деплоя.
- [ ] **CI/CD** — отдельный пайплайн для бота.

---

## Полезные ссылки

- [DiscordBot (исходник)](./src/main.py#L21-L89)
- [Kafka handler (исходник)](./src/main.py#L120-L135)
- [MOCK_CHANNEL_ID (исходник)](./src/main.py#L18)
- [discord.py документация](https://discordpy.readthedocs.io/)
- [Backend, отправляющий match_created / match_completed](../../backend/app/services/match_service.py)
- [Docker-конфигурация](../../infrastructure/docker-compose.yml)
- [Discord Developer Portal](https://discord.com/developers/applications)
