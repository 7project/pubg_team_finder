# PUBG Team Finder

> Веб-приложение для поиска тиммейтов в PUBG с автоматическим подбором игроков по рангу, системой рейтингов и Discord-интеграцией.

![Status](https://img.shields.io/badge/status-MVP-yellow)
![License](https://img.shields.io/badge/license-Private-red)
![Python](https://img.shields.io/badge/python-3.11-blue)
![Node](https://img.shields.io/badge/node-20-green)
![Docker](https://img.shields.io/badge/docker-compose-blue)

> 📚 **Документация в этом репозитории:** README-файлы в корне, `backend/`, `frontend/`, `infrastructure/`, `services/`.

---

## Содержание

1. [Что это](#что-это)
2. [Статус реализации](#статус-реализации)
3. [Архитектура](#архитектура)
4. [Сервисы проекта](#сервисы-проекта)
5. [Быстрый старт](#быстрый-старт)
6. [URLs после запуска](#urls-после-запуска)
7. [API Endpoints (сводка)](#api-endpoints-сводка)
8. [Kafka топики (сводка)](#kafka-топики-сводка)
9. [База данных (сводка)](#база-данных-сводка)
10. [Discord OAuth настройка](#discord-oauth-настройка)
11. [Тестирование](#тестирование)
12. [Graceful Degradation (философия)](#graceful-degradation-философия)
13. [Известные ограничения](#известные-ограничения)
14. [Что нужно доработать (глобально)](#что-нужно-доработать-глобально)
15. [Roadmap](#roadmap)

---

## Что это

**PUBG Team Finder** — это full-stack веб-приложение, которое помогает игрокам в PUBG находить тиммейтов по рангу, создавать группы, организовывать матчи и оценивать игроков после игр.

**Ключевые возможности:**

- 🔐 **Аутентификация через Discord OAuth** — без отдельной регистрации.
- 🔍 **Поиск игроков** с фильтрами по рангу, региону, статусу.
- 👥 **Группы** — создание команд, добавление участников.
- 🎮 **Матчи** — создание SQUAD/DUO/CUSTOM матчей, приглашения, подтверждения.
- ⭐ **Рейтинги** — оценка игроков после матчей по 5 критериям.
- 🔔 **Real-time уведомления** через WebSocket.
- 🤖 **Discord-бот** — автоматическое создание голосовых каналов.
- 📊 **Статистика** — данные с op.gg (с graceful fallback на mock).

---

## Статус реализации

| Компонент | Статус | README |
|-----------|--------|--------|
| Frontend (Next.js) | ✅ MVP | [frontend/README.md](./frontend/README.md) |
| Backend (FastAPI) | ✅ MVP | [backend/README.md](./backend/README.md) |
| Nginx proxy | ✅ | [infrastructure/README.md](./infrastructure/README.md) |
| PostgreSQL 15 | ✅ | [infrastructure/README.md](./infrastructure/README.md) |
| Redis 7 | ✅ | [infrastructure/README.md](./infrastructure/README.md) |
| Kafka 3.7 (KRaft) | ✅ | [infrastructure/README.md](./infrastructure/README.md) |
| Alembic миграции | ✅ | [backend/README.md#миграции-alembic](./backend/README.md#миграции-alembic) |
| Redis integration (RateLimiter, Session, Cache) | ✅ | [backend/README.md#redis-кэш-сессии-rate-limit](./backend/README.md#redis-кэш-сессии-rate-limit) |
| Kafka consumers (backend) | ✅ | [backend/README.md#kafka-producer--consumers](./backend/README.md#kafka-producer--consumers) |
| WebSocket уведомления | ✅ | [backend/README.md#websocket](./backend/README.md#websocket) |
| Кнопка "Завершить матч" | ✅ | [frontend/README.md](./frontend/README.md) |
| Форма оценки /rating/[id] | ✅ | [frontend/README.md](./frontend/README.md) |
| Parser Worker (microservice) | ✅ Mock | [services/parser_worker/README.md](./services/parser_worker/README.md) |
| Discord Bot (microservice) | ✅ Mock | [services/discord_bot/README.md](./services/discord_bot/README.md) |
| E2E тесты (Playwright) | ✅ Базовые | [frontend/README.md#e2e-тесты-playwright](./frontend/README.md#e2e-тесты-playwright) |
| CI/CD | ❌ TODO | [Что нужно доработать](#что-нужно-доработать-глобально) |
| HTTPS | ❌ TODO | [Что нужно доработать](#что-нужно-доработать-глобально) |
| Real op.gg парсер | ❌ TODO | [services/parser_worker/README.md](./services/parser_worker/README.md#что-нужно-доработать) |
| Production deployment (k8s) | ❌ TODO | [Что нужно доработать](#что-нужно-доработать-глобально) |

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                       FRONTEND (Next.js)                        │
│                    http://localhost:3000                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NGINX REVERSE PROXY                         │
│              localhost:80 → frontend:3000                       │
│              localhost:3000 → frontend:3000                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
┌───────────────────────────┐   ┌───────────────────────────────┐
│    BACKEND (FastAPI)      │   │      REST API /ws             │
│    localhost:8000         │   │      /api/v1/*               │
└───────────────────────────┘   └───────────────────────────────┘
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
┌───────┐ ┌─────────┐ ┌──────────┐
│Postgres│ │  Redis  │ │   Kafka  │
│ 5432   │ │  6379   │ │  9092    │
└───────┘ └─────────┘ └──────────┘
                ▲                           ▲
                │                           │
┌───────────────┴────────────┐ ┌────────────┴─────────────┐
│  parser_worker (Python)    │ │  discord_bot (discord.py) │
│  Kafka consumer, op.gg     │ │  Kafka consumer, channels │
│  (mock данных)             │ │  (mock fallback)          │
└────────────────────────────┘ └──────────────────────────┘
```

Подробнее: [infrastructure/README.md#архитектура](./infrastructure/README.md#архитектура).

---

## Сервисы проекта

| Сервис | Технология | Порт | Назначение | Документация |
|--------|------------|------|------------|--------------|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind | 3000 | UI приложения | [frontend/README.md](./frontend/README.md) |
| **Backend** | FastAPI, Python 3.11, SQLAlchemy 2.0 async | 8000 | REST API + WebSocket | [backend/README.md](./backend/README.md) |
| **Infrastructure** | Docker Compose, Nginx, Make | 80 | Деплой, proxy, оркестрация | [infrastructure/README.md](./infrastructure/README.md) |
| **Microservices** | Python 3.11, aiokafka, discord.py | — | Фоновые обработчики событий | [services/README.md](./services/README.md) |
| ├─ parser_worker | aiokafka + redis | — | Сбор статистики с op.gg (mock) | [services/parser_worker/README.md](./services/parser_worker/README.md) |
| └─ discord_bot | discord.py + aiokafka | — | Создание голосовых каналов Discord | [services/discord_bot/README.md](./services/discord_bot/README.md) |
| **PostgreSQL** | postgres:15-alpine | 5432 | Основная БД | — |
| **Redis** | redis:7-alpine | 6379 | Кэш, сессии, rate limit | — |
| **Kafka** | apache/kafka:3.7.0 (KRaft) | 9092 | Message queue | — |

---

## Быстрый старт

### Требования

- **Docker** 20+ и **Docker Compose** v2
- **Git** (для клонирования)
- **Discord Application** (для OAuth) — см. [Discord OAuth настройка](#discord-oauth-настройка)
- 4+ ГБ свободной RAM
- Порты 80, 3000, 5432, 6379, 8000, 9092 должны быть свободны

### Запуск полного стека (5 минут)

```bash
# 1. Клонировать репозиторий
git clone <repo-url> pubg-team-finder
cd pubg-team-finder

# 2. Скопировать .env и заполнить
cp infrastructure/.env.example infrastructure/.env
nano infrastructure/.env
# Заполнить: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN, SECRET_KEY

# 3. Запустить все сервисы
cd infrastructure
docker compose up -d

# 4. Дождаться запуска (30-60 секунд)
docker compose ps
docker compose logs -f

# 5. Открыть в браузере
# http://localhost — главная страница
# http://localhost:8000/docs — OpenAPI/Swagger
```

### Подробные инструкции

| Задача | Документация |
|--------|--------------|
| Запуск | [infrastructure/README.md#локальный-запуск](./infrastructure/README.md#локальный-запуск) |
| Makefile команды | [infrastructure/README.md#команды-makefile](./infrastructure/README.md#команды-makefile) |
| Бэкенд без Docker | [backend/README.md#локальный-запуск](./backend/README.md#локальный-запуск) |
| Фронтенд без Docker | [frontend/README.md#локальный-запуск](./frontend/README.md#локальный-запуск) |
| Микросервисы локально | [services/README.md#запуск](./services/README.md#запуск) |

---

## URLs после запуска

| URL | Что показывает |
|-----|----------------|
| `http://localhost` | Frontend через nginx (port 80) |
| `http://localhost:3000` | Frontend через nginx (port 3000) |
| `http://localhost:8000/docs` | OpenAPI / Swagger UI |
| `http://localhost:8000/redoc` | ReDoc |
| `http://localhost:8000/health` | `{"status": "healthy"}` |
| `http://localhost:8000/api/v1/...` | REST API |
| `ws://localhost/ws/notifications/{user_id}` | WebSocket |
| `localhost:5432` | PostgreSQL (user: `pubg_finder`, db: `pubg_finder`) |
| `localhost:6379` | Redis (`redis-cli`) |
| `localhost:9092` | Kafka (`kafka-console-consumer`) |

---

## API Endpoints (сводка)

> ⚠️ **Полная таблица**: [backend/README.md#api-endpoints](./backend/README.md#api-endpoints).

### Auth
- `GET /api/v1/auth/discord` — редирект на Discord OAuth
- `POST /api/v1/auth/discord/callback` — обмен кода на токены
- `POST /api/v1/auth/refresh` — обновление access token
- `GET /api/v1/auth/me` — текущий пользователь
- `POST /api/v1/auth/logout` — выход

### Users
- `GET /api/v1/users/me` — мой профиль
- `PATCH /api/v1/users/me` — обновить профиль
- `GET /api/v1/users/{id}` — профиль игрока
- `GET /api/v1/users/search/paginated` — поиск с фильтрами
- `GET /api/v1/users/{id}/rating-stats` — статистика рейтинга

### Groups
- `GET /api/v1/groups/` — список
- `POST /api/v1/groups/` — создать
- `PATCH /api/v1/groups/{id}` — обновить
- `DELETE /api/v1/groups/{id}` — удалить
- `POST /api/v1/groups/{id}/members` — добавить участника
- `DELETE /api/v1/groups/{id}/members/{user_id}` — удалить

### Matches
- `GET /api/v1/matches/suggestions` — предложения игроков
- `POST /api/v1/matches/` — создать
- `GET /api/v1/matches/` — список
- `GET /api/v1/matches/{id}` — детали
- `POST /api/v1/matches/{id}/invite/{user_id}` — пригласить
- `POST /api/v1/matches/{id}/accept` — принять
- `POST /api/v1/matches/{id}/leave` — покинуть
- `POST /api/v1/matches/{id}/complete` — завершить
- `POST /api/v1/matches/{id}/request-confirmation` — запросить подтверждение
- `POST /api/v1/matches/{id}/confirm` — подтвердить участие

### Ratings
- `POST /api/v1/ratings/` — создать оценку
- `GET /api/v1/ratings/user/{id}` — оценки пользователя

### Notifications
- `GET /api/v1/notifications/` — список
- `GET /api/v1/notifications/unread-count` — непрочитанные
- `PATCH /api/v1/notifications/{id}/read` — отметить прочитанной
- `POST /api/v1/notifications/read-all` — прочитать все

### Parser
- `GET /api/v1/parser/player/{username}` — статистика игрока

### WebSocket
- `WS /ws/notifications/{user_id}` — real-time уведомления

---

## Kafka топики (сводка)

> ⚠️ **Полная таблица**: [services/README.md#kafka-топики-и-контракты](./services/README.md#kafka-топики-и-контракты).

| Топик | Producer | Consumers | Описание |
|-------|----------|-----------|----------|
| `match_created` | backend | parser_worker, discord_bot | Создан новый матч |
| `match_completed` | backend | discord_bot | Матч завершён |
| `match_invite` | backend | (планируется) | Приглашение в матч |
| `invite_accepted` | backend | (планируется) | Приглашение принято |
| `match_left` | backend | (планируется) | Игрок покинул матч |
| `player_stats` | parser_worker | backend | Обновлена статистика |

**Формат `match_created`:**

```json
{
  "match_id": "uuid",
  "created_by": "uuid",
  "match_type": "SQUAD" | "DUO" | "CUSTOM",
  "max_players": 4,
  "players": [
    {"player_id": "uuid", "username": "string"}
  ]
}
```

---

## База данных (сводка)

> ⚠️ **Полная схема**: см. SQLAlchemy-модели в `backend/app/models/models.py` и Alembic-миграции.

| Таблица | Назначение | Ключевые поля |
|---------|------------|---------------|
| `users` | Пользователи | `id, discord_id, username, pubg_nickname` |
| `groups` | Группы | `id, name, owner_id` |
| `group_members` | Участники групп | `group_id, user_id` |
| `matches` | Матчи | `id, created_by, status, match_type` |
| `match_participants` | Участники матчей | `match_id, user_id, status, is_ready` |
| `ratings` | Оценки игроков | `match_id, from_user_id, to_user_id, friendliness, skill, adequacy, character_rating, is_inadequate` |
| `notifications` | Уведомления | `user_id, type, match_id, is_read` |
| `player_stats` | Кэш статистики | `op_gg_identifier` |

**Enums:**

- `UserStatus`: `ACTIVE | BUSY | OFFLINE`
- `MatchStatus`: `PENDING | ACTIVE | COMPLETED | CANCELLED`
- `MatchType`: `SQUAD (4) | DUO (2) | CUSTOM (10)`
- `MatchParticipantStatus`: `INVITED | ACCEPTED | DECLINED`
- `PrivacySetting`: `PUBLIC | GROUP_ONLY | NO_INVITES`
- `ActivityLevel`: `ACTIVE | PASSIVE | AVERAGE`

**Миграции:** Alembic. Запускаются автоматически контейнером `alembic-migrate` при старте стека.

```bash
# Создать новую миграцию
docker compose exec backend alembic revision --autogenerate -m "add field X"

# Применить миграции
docker compose exec backend alembic upgrade head
```

---

## Discord OAuth настройка

### 1. Создать Discord Application

1. Открыть [Discord Developer Portal](https://discord.com/developers/applications).
2. **New Application** → ввести имя → **Bot** → **Add Bot** (опционально, для бота).
3. Скопировать **Client ID** и **Client Secret**.

### 2. Настроить Redirect URI

1. **OAuth2 → Redirects**.
2. Добавить: `http://localhost/api/v1/auth/discord/callback`
3. Save. Подождать 5-10 минут для применения.

### 3. Заполнить `.env`

```env
DISCORD_CLIENT_ID=<your_discord_client_id>
DISCORD_CLIENT_SECRET=ваш_секрет
DISCORD_REDIRECT_URI=http://localhost/api/v1/auth/discord/callback
SECRET_KEY=$(openssl rand -hex 32)
```

### 4. Для Discord-бота (опционально)

1. В Bot → **Copy Token** → `DISCORD_BOT_TOKEN`.
2. **OAuth2 → URL Generator**: scopes `bot`, permissions `Manage Channels`, `Connect`.
3. Открыть URL → выбрать сервер.
4. Получить `DISCORD_GUILD_ID` и `DISCORD_CATEGORY_ID` (через Developer Mode).

> ⚠️ **Troubleshooting**:
> - "invalid redirect_uri" → проверить URL в Developer Portal, подождать 10 минут.
> - Не работает вход → проверить `SECRET_KEY` (минимум 32 символа).

---

## Тестирование

### Backend (pytest)

```bash
# Внутри Docker
docker compose exec backend pytest

# С покрытием
docker compose exec backend pytest --cov=app

# Конкретный файл
docker compose exec backend pytest tests/test_discord_oauth.py -v
```

**Текущее покрытие:** 81 тест проходит ✅.

### Frontend (Vitest)

```bash
cd frontend
npm install --legacy-peer-deps
npm run test                  # Watch mode
npx vitest run --coverage
```

### E2E (Playwright)

```bash
cd frontend
npx playwright install --with-deps chromium
npx playwright test
npx playwright test --ui
```

Покрытые сценарии: [frontend/README.md#e2e-тесты-playwright](./frontend/README.md#e2e-тесты-playwright).

### Линтинг

```bash
# Backend
docker compose exec backend ruff check .

# Frontend
cd frontend
npm run lint
```

---

## Graceful Degradation (философия)

**Ключевой принцип:** ни один компонент не должен ломать основной поток при недоступности внешних зависимостей.

| Сценарий | Реакция |
|----------|---------|
| Kafka недоступна | Backend логирует warning, продолжает работать. Consumer'ы не стартуют. |
| Redis недоступна | RateLimiter/SessionManager fail-open, кэш возвращает `None`. |
| WebSocket оборвался | Клиент автоматически реконнектится (exponential backoff, до 10 попыток). |
| Discord API недоступен | `discord_bot` возвращает `MOCK_CHANNEL_ID` + лог. |
| op.gg недоступен | `parser_worker` возвращает `MOCK_STATS` + лог. |
| Неожиданное исключение в handler | Логируется, цикл consumer'а продолжается. |
| Discord bot token пустой | Mock-режим для всех операций. |

Подробнее: [services/README.md#философия-graceful-degradation](./services/README.md#философия-graceful-degradation).

---

## Известные ограничения

1. **CORS** — настроен только для `localhost`, `localhost:80`, `localhost:3000`, `frontend:3000`. Для production нужно расширить.
2. **Kafka** — single broker, не подходит для production (KRaft, но без репликации).
3. **WebSocket** — автореконнект работает на клиенте, но сервер не валидирует JWT при handshake.
4. **OP.GG Parser** — реальный парсинг не реализован, используются mock-данные.
5. **Discord bot** — `active_channels` хранится в памяти, теряется при рестарте.
6. **Нет HTTPS** — nginx слушает только 80 порт.
7. **Нет CI/CD** — деплой только вручную через `docker compose`.
8. **Rate limiting** — `RateLimiter` в Redis реализован, но middleware не подключён в `main.py`.
9. **Observability** — нет метрик, трассировки, structured логов.
10. **Секреты** — хранятся в `.env`, нет Vault/Secrets Manager.

---

## Что нужно доработать (глобально)

> Раздел "Что нужно доработать" также есть в каждом сервисном README:
> - [backend/README.md#что-нужно-доработать](./backend/README.md#что-нужно-доработать)
> - [frontend/README.md#что-нужно-доработать](./frontend/README.md#что-нужно-доработать)
> - [infrastructure/README.md#что-нужно-доработать](./infrastructure/README.md#что-нужно-доработать)
> - [services/README.md#что-нужно-доработать](./services/README.md#что-нужно-доработать)
> - [services/parser_worker/README.md#что-нужно-доработать](./services/parser_worker/README.md#что-нужно-доработать)
> - [services/discord_bot/README.md#что-нужно-доработать](./services/discord_bot/README.md#что-нужно-доработать)

### DevOps / Infra (критично для production)

- [ ] **CI/CD** — GitHub Actions / GitLab CI: lint → test → build → deploy.
- [ ] **HTTPS** — настроить `certbot` или self-signed в nginx, переключить на 443.
- [ ] **Production deployment** — k8s manifests (Helm charts) или terraform для AWS/GCP/Azure.
- [ ] **Secrets management** — Vault / AWS Secrets Manager / Docker secrets вместо `.env`.
- [ ] **Backup** — автоматический `pg_dump` + загрузка в S3/Blob Storage.
- [ ] **Мониторинг** — Prometheus + Grafana (или Datadog / New Relic).
- [ ] **Логи в ELK/Loki** — structured JSON логи + Filebeat/Fluentd.
- [ ] **Distributed tracing** — OpenTelemetry + Jaeger / Zipkin.
- [ ] **Resource limits** — `mem_limit`, `cpus` для каждого контейнера.
- [ ] **Read-only root filesystem** где возможно.
- [ ] **Multi-broker Kafka** — `KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=3`, минимум 3 брокера.
- [ ] **kafka-init контейнер** — автоматическое создание топиков.

### Security

- [ ] **JWT на WebSocket handshake** — сейчас любой может подключиться по `user_id`.
- [ ] **Rate limiting middleware** — подключить `RateLimiter` в `main.py`.
- [ ] **CORS** — вынести `allowed_origins` в `.env`.
- [ ] **CSRF** — проверка для форм (кроме OAuth).
- [ ] **Secrets rotation** — автоматическая ротация JWT secret, Discord token.
- [ ] **Security audit** — bandit (Python), npm audit, snyk.

### Backend

- [ ] **OpenAPI descriptions** — `description=` и `example=` для всех эндпоинтов.
- [ ] **Unit-тесты** для `app/services/*.py` (match_service, discord_service).
- [ ] **Интеграционные тесты** с testcontainers.
- [ ] **Alembic индексы** — на `users.pubg_nickname`, `users.discord_id`, `matches.created_by`, `notifications.user_id`.
- [ ] **JSON-логи** — `python-json-logger` для ELK/Loki.
- [ ] **WebSocket фильтр** — `match_id` фильтр на сервере.
- [ ] **API versioning** — подготовить миграцию на `/api/v2/`.
- [ ] **Prometheus metrics** — `/metrics` endpoint, OpenTelemetry.

### Frontend

- [ ] **Storybook** — для UI-компонентов (`src/components/ui/`).
- [ ] **Error Boundary** на верхнем уровне `app/layout.tsx`.
- [ ] **Loading skeletons** вместо `<Spinner />`.
- [ ] **Unit-тесты** для hooks (`use-websocket`) и Zustand store.
- [ ] **A11y** — aria-атрибуты в формах, фокус-стили, навигация с клавиатуры.
- [ ] **i18n** — добавить `en.json` (сейчас только `ru.json`).
- [ ] **Адаптивность** — протестировать mobile/tablet.
- [ ] **`output: 'standalone'`** в `next.config.js` для production Docker.
- [ ] **Lighthouse** — perf > 90, a11y > 95, SEO > 95.
- [ ] **SEO** — `generateMetadata()` для публичных страниц.
- [ ] **Bundle analyzer** — `@next/bundle-analyzer`.

### Microservices

- [ ] **Unit-тесты** для `parser_worker` и `discord_bot`.
- [ ] **Real op.gg парсер** — заменить mock на реальный httpx + BeautifulSoup.
- [ ] **Rate limit handling** для op.gg и Discord API.
- [ ] **Персистентность `active_channels`** в Redis для `discord_bot`.
- [ ] **JSON Schema валидация** входящих Kafka-сообщений.
- [ ] **Dead Letter Queue** для невалидных сообщений.
- [ ] **Graceful shutdown** — обработка SIGTERM.
- [ ] **Горизонтальное масштабирование** — несколько инстансов + consumer groups.

### Документация и процесс

- [ ] **LICENSE** — выбрать и добавить (MIT / Apache 2.0 / proprietary).
- [ ] **CONTRIBUTING.md** — гайд для контрибьюторов.
- [ ] **CHANGELOG.md** — история изменений.
- [ ] **SECURITY.md** — политика безопасности и контакты.
- [ ] **ADR (Architecture Decision Records)** — для CORS-фикса, UUID-фикса, выбора Kafka.
- [ ] **C4 / Mermaid диаграммы** в `docs/architecture/`.
- [ ] **Pre-commit hooks** — black, isort, ruff, mypy, eslint, prettier.
- [ ] **CODEOWNERS** — распределение зон ответственности.
- [ ] **Issue templates** и **PR templates** в `.github/`.

---

## Roadmap

### Q1 (ближайшее)
1. CI/CD пайплайн (GitHub Actions).
2. HTTPS + production deployment.
3. Unit-тесты для `app/services/*.py`.
4. WebSocket JWT-проверка.
5. Rate limiting middleware.
6. `en.json` для i18n.
7. Error Boundary.

### Q2
1. Real op.gg парсер.
2. Real Discord API (с retry/rate limit).
3. Helm charts для k8s.
4. Prometheus + Grafana.
5. Multi-broker Kafka.
6. Persisted metrics (player_stats).

### Q3+
1. Горизонтальное масштабирование.
2. Distributed tracing.
3. PWA / Mobile app.
4. Продвинутые рейтинги (Elo / TrueSkill).
5. Кланы / команды (постоянные).
6. Турниры.
7. PUBG API интеграция (если появится public API).

---

## Документация проекта

| Документ | Назначение |
|----------|------------|
| [README.md](./README.md) | Этот файл — точка входа |
| [backend/README.md](./backend/README.md) | Backend (FastAPI) |
| [frontend/README.md](./frontend/README.md) | Frontend (Next.js) |
| [infrastructure/README.md](./infrastructure/README.md) | Docker, Nginx, Make |
| [services/README.md](./services/README.md) | Микросервисы (общий) |
| [services/parser_worker/README.md](./services/parser_worker/README.md) | OP.GG parser (mock) |
| [services/discord_bot/README.md](./services/discord_bot/README.md) | Discord bot |

---

## Лицензия

Private / Unlicensed (MVP). См. [Что нужно доработать](#что-нужно-доработать-глобально) → LICENSE.

---

## Контрибьюция

См. правила разработки в этом README и в подпапках (backend/, frontend/, services/).

**Quick rules:**

- Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
- TypeScript: `any` запрещён, все функции с типами возврата.
- Python: type hints обязательны, Pydantic v2 для валидации.
- Pre-commit: `black`, `isort`, `ruff`, `mypy`, `eslint`, `prettier` (планируется).
- Все API endpoints — в `/api/v1/`, пагинация через `page` и `page_size`.
- Alembic для изменений БД (raw SQL в коде запрещён).

---

## Поддержка

Вопросы / баги → Issues в репозитории.
Безопасность → создать `SECURITY.md` (см. [Что нужно доработать](#что-нужно-доработать-глобально)).
