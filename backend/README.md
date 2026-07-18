# Backend (FastAPI)

REST API и WebSocket-сервер для проекта **PUBG Team Finder** — поиска тиммейтов в PUBG.

> Главный README проекта: [`../README.md`](../README.md)

---

## Содержание

1. [Описание](#описание)
2. [Технологический стек](#технологический-стек)
3. [Структура каталогов](#структура-каталогов)
4. [API Endpoints](#api-endpoints)
5. [WebSocket](#websocket)
6. [Локальный запуск](#локальный-запуск)
7. [Тестирование](#тестирование)
8. [Миграции Alembic](#миграции-alembic)
9. [Kafka producer / consumers](#kafka-producer--consumers)
10. [Redis (кэш, сессии, rate limit)](#redis-кэш-сессии-rate-limit)
11. [Переменные окружения](#переменные-окружения)
12. [Graceful Degradation](#graceful-degradation)
13. [Известные багфиксы](#известные-багфиксы)
14. [Что нужно доработать](#что-нужно-доработать)

---

## Описание

Backend реализует:

- **REST API** версии `/api/v1/` с эндпоинтами для аутентификации (Discord OAuth), пользователей, групп, матчей, рейтингов, уведомлений и парсера OP.GG.
- **WebSocket** для real-time уведомлений пользователям.
- **Асинхронный доступ к PostgreSQL** через SQLAlchemy 2.0 + AsyncPG.
- **Kafka producer и consumers** для асинхронной обработки событий матчей и уведомлений.
- **Redis** для rate limiting, сессий, кэша статистики игроков и кэша матчей.
- **JWT аутентификацию** (access 15 минут + refresh 7 дней) поверх Discord OAuth.
- **Alembic** миграции схемы БД.

Контейнер: `pubg_finder_backend`. Порт: `8000`. Запускается через `uvicorn` с `--reload` в dev-режиме.

---

## Технологический стек

| Компонент | Версия | Назначение |
|-----------|--------|------------|
| Python | 3.11 | Runtime |
| FastAPI | 0.109.0 | Web-фреймворк |
| Uvicorn | 0.27.0 | ASGI-сервер |
| SQLAlchemy | 2.0.25 | ORM (async) |
| AsyncPG | 0.29.0 | Драйвер PostgreSQL |
| Pydantic | 2.5.3 | Валидация / сериализация |
| Pydantic-Settings | 2.1.0 | Управление конфигурацией |
| Alembic | 1.13.1 | Миграции БД |
| python-jose | 3.3.0 | JWT |
| passlib[bcrypt] | 1.7.4 | Хеширование (если требуется) |
| redis-py | 5.0.1 | Клиент Redis |
| aiokafka | 0.10.0 | Клиент Kafka |
| httpx | 0.26.0 | HTTP-клиент (Discord API) |
| pytest | 7.4.4 | Тесты |
| pytest-asyncio | 0.23.3 | Async-тесты |
| ruff | 0.1.11 | Линтер / форматтер |

Полный список зависимостей: [`requirements.txt`](./requirements.txt).

---

## Структура каталогов

```
backend/
├── app/                            # Исходный код приложения
│   ├── main.py                     # FastAPI app factory, lifespan, WebSocket
│   ├── seed.py                     # Загрузка демо-данных в БД
│   │
│   ├── api/                        # HTTP роутеры
│   │   └── v1/
│   │       ├── auth.py             # Discord OAuth, JWT refresh, /me
│   │       ├── users.py            # Профили, поиск, рейтинг-статистика
│   │       ├── groups.py           # CRUD групп
│   │       ├── matches.py          # Матчи, приглашения, завершение
│   │       ├── ratings.py          # Оценки игроков
│   │       ├── parser.py           # OP.GG parser (через Kafka)
│   │       └── notifications.py    # Список уведомлений, read/unread
│   │
│   ├── core/                       # Инфраструктура приложения
│   │   ├── config.py               # Pydantic Settings (.env)
│   │   ├── database.py             # Async SQLAlchemy engine
│   │   ├── security.py             # JWT decode/encode, get_current_user
│   │   ├── kafka.py                # Kafka producer (singleton)
│   │   ├── redis.py                # RateLimiter, SessionManager, кэши
│   │   ├── middleware.py           # HTTP middleware
│   │   └── consumers.py            # NotificationConsumer, MatchEventsConsumer
│   │
│   ├── models/                     # SQLAlchemy ORM модели
│   │   └── models.py               # User, Group, Match, Rating, Notification...
│   │
│   ├── schemas/                    # Pydantic v2 схемы
│   │   └── schemas.py              # Request/Response модели, PaginatedResponse[T]
│   │
│   └── services/                   # Бизнес-логика
│       ├── match_service.py        # Создание/завершение матчей, инвайты
│       └── discord_service.py      # WebSocketManager + register/unregister
│
├── alembic/                        # Миграции БД
│   ├── env.py
│   └── versions/
│
├── tests/                          # Pytest тесты
│   └── test_discord_oauth.py       # 14 тестов OAuth
│
├── Dockerfile                      # python:3.11-slim + uvicorn
├── requirements.txt
├── alembic.ini
└── pytest.ini
```

---

## API Endpoints

> Полная таблица эндпоинтов — в этом README (ниже).

### Auth `/api/v1/auth/`
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/discord` | Редирект на Discord OAuth |
| POST | `/discord/callback` | Обмен кода на токены |
| POST | `/refresh` | Обновление access token |
| POST | `/logout` | Выход |
| GET | `/me` | Текущий пользователь |

### Users `/api/v1/users/`
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/me` | Мой профиль |
| PATCH | `/me` | Обновить профиль |
| GET | `/{id}` | Профиль игрока |
| GET | `/search/paginated` | Поиск с фильтрами (ранг, статус, etc.) |
| GET | `/{id}/rating-stats` | Средний рейтинг и статистика |

### Groups `/api/v1/groups/`
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/` | Список (пагинация) |
| POST | `/` | Создать |
| GET | `/{id}` | Детали |
| PATCH | `/{id}` | Обновить |
| DELETE | `/{id}` | Удалить |
| POST | `/{id}/members` | Добавить участника |
| DELETE | `/{id}/members/{user_id}` | Удалить участника |

### Matches `/api/v1/matches/`
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/suggestions` | Предложения игроков (с приоритетом группы) |
| POST | `/` | Создать матч |
| GET | `/` | Список (пагинация) |
| GET | `/{id}` | Детали |
| PATCH | `/{id}` | Обновить |
| DELETE | `/{id}` | Отменить |
| POST | `/{id}/invite/{user_id}` | Пригласить |
| POST | `/{id}/accept` | Принять приглашение |
| POST | `/{id}/leave` | Покинуть |
| POST | `/{id}/complete` | Завершить |
| DELETE | `/{id}/participants/{user_id}` | Удалить участника |
| POST | `/{id}/request-confirmation` | Запросить подтверждение |
| POST | `/{id}/confirm` | Подтвердить участие |

### Ratings `/api/v1/ratings/`
| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/` | Создать оценку (после завершённого матча) |
| GET | `/user/{id}` | Оценки пользователя |

### Notifications `/api/v1/notifications/`
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/` | Список (пагинация) |
| GET | `/unread-count` | Количество непрочитанных |
| PATCH | `/{id}/read` | Отметить прочитанной |
| POST | `/read-all` | Прочитать все |

### Parser `/api/v1/parser/`
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/player/{username}` | Статистика игрока (через parser_worker) |

### Прочее
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/health` | Health check (вне `/api/v1/`) |

---

## WebSocket

```
WS /ws/notifications/{user_id}
```

**Назначение:** real-time уведомления пользователю.

**Реализация:** [`app/main.py:86`](./app/main.py) — endpoint регистрирует соединение в `discord_service.register_notification_socket` и отвечает на `ping` сообщением `{"type": "pong"}`.

**События сервер → клиент** (отправляются из `NotificationConsumer` / `MatchEventsConsumer`):

```typescript
interface NotificationEvent {
  event_type: "match_invite_sent" | "invite_accepted" | "match_left" |
              "participant_removed" | "confirmation_requested" |
              "match_cancelled" | "participant_ready";
  match_id: string;
  [key: string]: any;
}
```

**Автореконнект на клиенте:** не реализован (см. раздел "Что нужно доработать").

**Nginx-проксирование:** см. [`../infrastructure/README.md`](../infrastructure/README.md#nginx-маршрутизация) — блок `location /ws/`.

---

## Локальный запуск

### Вариант 1: Через Docker Compose (рекомендуется)

```bash
cd ../infrastructure
cp .env.example .env
# отредактируйте .env (DISCORD_*, SECRET_KEY)
docker compose up -d backend
docker compose logs -f backend
```

### Вариант 2: Локально без Docker

Требуется: Python 3.11, PostgreSQL 15, Redis 7, Kafka (опционально — без Kafka consumers не стартуют, но API работает).

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Linux/macOS
# или: .venv\Scripts\activate     # Windows

pip install -r requirements.txt

# Установить переменные окружения (см. таблицу ниже)
export DATABASE_URL=postgresql+asyncpg://pubg_finder:pubg_finder_secret@localhost:5432/pubg_finder
export REDIS_URL=redis://localhost:6379
export KAFKA_BOOTSTRAP_SERVERS=localhost:9092
export DISCORD_CLIENT_ID=...
export DISCORD_CLIENT_SECRET=...
export SECRET_KEY=$(openssl rand -hex 32)

# Применить миграции
alembic upgrade head

# Загрузить демо-данные
python -m app.seed

# Запустить
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

API будет доступен на `http://localhost:8000`, OpenAPI — `http://localhost:8000/docs`.

---

## Тестирование

```bash
# Все тесты
pytest

# Только OAuth
pytest tests/test_discord_oauth.py -v

# С покрытием
pytest --cov=app tests/

# Внутри Docker
docker compose exec backend pytest
```

Текущее покрытие: **81 тест проходит**.

---

## Миграции Alembic

```bash
# Применить все миграции
alembic upgrade head

# Откатить одну миграцию
alembic downgrade -1

# Создать новую миграцию (после изменения моделей)
alembic revision --autogenerate -m "add field X to User"

# Посмотреть текущую ревизию
alembic current
```

В `docker-compose.yml` миграции выполняются контейнером `alembic-migrate` автоматически перед стартом backend.

---

## Kafka producer / consumers

### Producer

[`app/core/kafka.py`](./app/core/kafka.py) — singleton-обёртка над `AIOKafkaProducer`.

Используется в:
- `match_service.create_match` → `match_created`
- `match_service.complete_match` → `match_completed`
- `match_service.accept_invite` → `invite_accepted`
- ...

### Consumers

[`app/core/consumers.py`](./app/core/consumers.py) — фоновые consumer'ы стартуют в `lifespan`:

| Класс | Топики | Назначение |
|-------|--------|------------|
| `NotificationConsumer` | `match_events` → `notifications` | Рассылка уведомлений через WebSocketManager |
| `MatchEventsConsumer` | `match_created`, `match_completed` | Обновление состояния матчей в БД |

При недоступности Kafka backend **логирует предупреждение и продолжает работать** (graceful degradation).

### Контракты сообщений

```json
// match_created
{
  "match_id": "uuid",
  "created_by": "uuid",
  "match_type": "SQUAD",
  "max_players": 4,
  "players": [
    {"player_id": "uuid", "username": "player1"}
  ]
}

// match_completed
{ "match_id": "uuid" }
```

Подробнее: [services/README.md#kafka-топики-и-контракты](../services/README.md#kafka-топики-и-контракты).

---

## Redis (кэш, сессии, rate limit)

[`app/core/redis.py`](./app/core/redis.py) предоставляет:

| Класс | Назначение | TTL |
|-------|------------|-----|
| `RateLimiter` | Rate limit на эндпоинтах | 60s |
| `SessionManager` | Хранение refresh-токенов | 7d |
| `PlayerStatsCache` | Кэш статистики игроков | 1h |
| `MatchCache` | Кэш деталей матча | 5m |

### Схема ключей

```
player_stats:{player_id}     # JSON статистика
user_session:{user_id}        # Session data
rate_limit:{user_id}         # Счётчик запросов
match_cache:{match_id}        # Данные матча
```

---

## Переменные окружения

| Переменная | Обязательна | Пример | Описание |
|------------|-------------|--------|----------|
| `DATABASE_URL` | ✅ | `postgresql+asyncpg://user:pass@postgres:5432/db` | Async SQLAlchemy URL |
| `REDIS_URL` | ✅ | `redis://redis:6379` | Redis URL |
| `KAFKA_BOOTSTRAP_SERVERS` | ✅ | `kafka:9092` | Kafka bootstrap |
| `DISCORD_CLIENT_ID` | ✅ | `<your_discord_client_id>` | Discord OAuth client |
| `DISCORD_CLIENT_SECRET` | ✅ | `***` | Discord OAuth secret |
| `DISCORD_BOT_TOKEN` | ✅ | `***` | Discord bot token (для микросервиса) |
| `DISCORD_REDIRECT_URI` | ❌ | `http://localhost/api/v1/auth/discord/callback` | OAuth callback |
| `SECRET_KEY` | ✅ | (32+ символов) | JWT signing key |
| `DEBUG` | ❌ | `true` | Включает подробные логи |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | ❌ | `15` | TTL access token |
| `REFRESH_TOKEN_EXPIRE_DAYS` | ❌ | `7` | TTL refresh token |

Генерация `SECRET_KEY`: `openssl rand -hex 32`.

---

## Graceful Degradation

Backend проектировался с принципом **никогда не падать**:

1. **Kafka недоступна** — `lifespan` логирует warning, API продолжает работать; producer'ы игнорируют ошибки отправки.
2. **Redis недоступна** — `RateLimiter` и `SessionManager` пропускают запросы (fail-open).
3. **WebSocket оборвался** — клиент должен реконнектиться (см. TODO).
4. **Внешние API (Discord, OP.GG)** — обрабатываются с try/except и мок-ответами.

---

## Известные багфиксы

1. **UUID Type Error** в `app/api/v1/users.py` — заменён `uuid4` (функция) на `UUID` (тип) в аннотациях.
2. **CORS** — заголовки добавляет только FastAPI (CORSMiddleware), nginx проксирует их через `proxy_pass_header`.
3. **500 на /api/v1/matches/** — решён после фиксов CORS и UUID.

---

## Что нужно доработать

- [ ] Расширить OpenAPI: добавить `description=` и примеры (`example=`) для каждого эндпоинта через `@router.doc()` или Pydantic `Field(..., description=...)`.
- [ ] Подключить `make seed` (файл [`app/seed.py`](./app/seed.py) уже существует, но не интегрирован в `docker-compose`).
- [ ] Добавить unit-тесты для [`app/services/match_service.py`](./app/services/match_service.py) и [`app/services/discord_service.py`](./app/services/discord_service.py) — сейчас покрыты только OAuth.
- [ ] Добавить интеграционные тесты с testcontainers (Postgres + Redis + Kafka).
- [ ] Alembic: добавить индексы на `users.pubg_nickname`, `users.discord_id`, `matches.created_by`, `notifications.user_id` (если не сделаны в миграциях).
- [ ] Docker: добавить `healthcheck` для контейнера `backend` (curl `/health`).
- [ ] Логи: перевести в JSON-формат для ELK / Loki (`python-json-logger`).
- [ ] Rate limiting: добавить middleware (используется `RateLimiter` в Redis, но middleware не зарегистрирован в `main.py`).
- [ ] CORS: явно вынести origins в `.env` (`ALLOWED_ORIGINS`), сейчас захардкожены в `main.py:62-68`.
- [ ] Документация: добавить docstring'и в `app/services/*.py` (бизнес-логика).
- [ ] WebSocket: добавить JWT-проверку на handshake (сейчас любой может подключиться по `user_id`).
- [ ] WebSocket: добавить `match_id` фильтр, чтобы клиент получал только свои события.
- [ ] Перенести секреты в Vault / AWS Secrets Manager (сейчас `.env`).
- [ ] Настроить `pre-commit` (black, isort, ruff, mypy).
- [ ] Добавить `Makefile` (или переиспользовать `infrastructure/Makefile`).
- [ ] Версионирование API: подготовить миграцию на `/api/v2/` для будущих breaking changes.
- [ ] Observability: добавить Prometheus metrics (`/metrics`), OpenTelemetry tracing.
- [ ] Ограничить upload файлов (если планируется) — `python-multipart` уже в зависимостях.

---

## Полезные команды

```bash
# Внутри контейнера
docker compose exec backend bash

# Логи в реальном времени
docker compose logs -f backend

# Перезапуск
docker compose restart backend

# Проверка состояния
curl http://localhost:8000/health
curl http://localhost:8000/docs
```
