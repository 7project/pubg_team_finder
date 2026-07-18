# Infrastructure (Docker, Nginx, Make)

Полный Docker-стек для **PUBG Team Finder**: контейнеры приложений, инфраструктурных сервисов, reverse proxy и Makefile для управления.

> Главный README проекта: [`../README.md`](../README.md)  
> Backend: [`../backend/README.md`](../backend/README.md)  
> Frontend: [`../frontend/README.md`](../frontend/README.md)  
> Микросервисы: [`../services/README.md`](../services/README.md)

---

## Содержание

1. [Описание](#описание)
2. [Архитектура](#архитектура)
3. [Контейнеры](#контейнеры)
4. [Сетевое взаимодействие](#сетевое-взаимодействие)
5. [Nginx маршрутизация](#nginx-маршрутизация)
6. [Локальный запуск](#локальный-запуск)
7. [Команды Makefile](#команды-makefile)
8. [Переменные окружения](#переменные-окружения)
9. [Volumes и персистентность](#volumes-и-персистентность)
10. [Healthchecks](#healthchecks)
11. [Логи и диагностика](#логи-и-диагностика)
12. [Известные багфиксы](#известные-багфиксы)
13. [Что нужно доработать](#что-нужно-доработать)

---

## Описание

`infrastructure/` содержит всё, что нужно для запуска **полного стека** в Docker:

- **`docker-compose.yml`** — production-grade compose для всей системы (8 контейнеров).
- **`docker-compose.dev.yml`** — упрощённый compose для разработки (без Kafka и микросервисов, порты напрямую).
- **`nginx/nginx.conf`** — reverse proxy с маршрутизацией `/api/`, `/ws/`, `/`.
- **`postgres/init.sql`** — инициализация БД (UUID extension, остальное через Alembic).
- **`Makefile`** — короткие команды для типовых операций.
- **`.env` / `.env.example`** — переменные окружения.

Compose использует единую сеть `pubg_finder_network` для всех сервисов.

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
└────────────────────────────┘ └──────────────────────────┘
```

---

## Контейнеры

| Контейнер | Образ / Build | Порты (host:container) | Назначение |
|-----------|---------------|------------------------|------------|
| `pubg_finder_postgres` | `postgres:15-alpine` | `5432:5432` | Основная БД |
| `pubg_finder_redis` | `redis:7-alpine` | `6379:6379` | Кэш, сессии, rate limit |
| `pubg_finder_kafka` | `apache/kafka:3.7.0` (KRaft) | `9092:9092` | Message queue |
| `pubg_finder_migrate` | build `../backend` | — | Одноразовый: `alembic upgrade head` |
| `pubg_finder_backend` | build `../backend` | `8000:8000` | FastAPI приложение |
| `pubg_finder_frontend` | build `../frontend` | — (только через nginx) | Next.js приложение |
| `pubg_finder_nginx` | `nginx:alpine` | `80:80`, `3000:3000` | Reverse proxy |
| `pubg_finder_parser` | build `../services/parser_worker` | — | OP.GG scraper (mock) |
| `pubg_finder_discord` | build `../services/discord_bot` | — | Discord voice channels |

> Контейнер `alembic-migrate` запускается с `restart: "no"` и выполняет миграции до старта `backend`.

---

## Сетевое взаимодействие

Все сервисы в одном compose подключены к сети `pubg_finder_network` (`name: pubg_finder_network`).

**Правило:** между контейнерами использовать **имя сервиса**, НЕ `localhost`.

| Откуда | Куда | URL |
|--------|------|-----|
| nginx | backend | `http://backend:8000` |
| nginx | frontend | `http://frontend:3000` |
| backend | postgres | `postgresql+asyncpg://pubg_finder:pubg_finder_secret@postgres:5432/pubg_finder` |
| backend | redis | `redis://redis:6379` |
| backend | kafka | `kafka:9092` |
| parser_worker | redis | `redis://redis:6379/0` |
| parser_worker | kafka | `kafka:9092` |
| discord_bot | kafka | `kafka:9092` |
| frontend (build-time) | nginx | `http://nginx/api` |

> **Env-переменные** для frontend: `NEXT_PUBLIC_API_URL=http://nginx/api`, `NEXT_PUBLIC_WS_URL=ws://nginx/ws` — это используется в браузере.

---

## Nginx маршрутизация

Файл: [`nginx/nginx.conf`](./nginx/nginx.conf). Содержит **два идентичных server-блока**: `listen 80` и `listen 3000` (для прямого доступа в dev).

### Правила

| Location | Прокси на | Особенности |
|----------|-----------|-------------|
| `/` | `http://frontend` | SSR Next.js |
| `~ ^/api/auth/callback` | `http://frontend` | OAuth callback (Next.js API route) |
| `~ ^/api/auth/set-session` | `http://frontend` | Установка cookie после callback |
| `/api/` | `http://backend` | REST API |
| `/ws/` | `http://backend` | WebSocket (proxy с `Upgrade`/`Connection`) |

### WebSocket-проксирование

```nginx
location /ws/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;        # 1 день — держим соединение
}
```

### CORS

**Важно:** Nginx НЕ добавляет CORS-заголовки (`add_header`). CORS настраивает **только FastAPI** (CORSMiddleware в [`app/main.py:61`](../backend/app/main.py)). Nginx проксирует заголовки от backend через `proxy_pass_header` (для production override) либо просто передаёт `Host`/`X-Real-IP`/`X-Forwarded-*`.

---

## Локальный запуск

### Полный стек (production-grade)

```bash
cd infrastructure

# 1. Скопировать .env
cp .env.example .env
# 2. Заполнить DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN, SECRET_KEY
nano .env

# 3. Валидация конфигурации
docker compose config

# 4. Запуск
docker compose up -d

# 5. Проверка статуса
docker compose ps
```

### Упрощённый стек (для разработки)

`docker-compose.dev.yml` — без Kafka, parser_worker, discord_bot. Используется с `Makefile`.

```bash
make up
```

### Проверка после запуска

| URL | Что показывает |
|-----|----------------|
| `http://localhost` | Frontend через nginx (port 80) |
| `http://localhost:3000` | Frontend через nginx (port 3000) |
| `http://localhost:8000/docs` | OpenAPI / Swagger UI |
| `http://localhost:8000/health` | `{"status": "healthy"}` |
| `http://localhost:8000/api/v1/...` | REST API |
| `ws://localhost/ws/notifications/{user_id}` | WebSocket |
| `localhost:5432` | PostgreSQL (user: `pubg_finder`, db: `pubg_finder`) |
| `localhost:6379` | Redis |
| `localhost:9092` | Kafka |

---

## Команды Makefile

> ⚠️ Текущий [`Makefile`](./Makefile) использует `docker-compose.dev.yml` (НЕ `docker-compose.yml`). Команды `migrate`, `test`, `lint` объявлены в `.PHONY`, но не реализованы.

```makefile
make help        # Показать все доступные команды
make up          # Запустить упрощённый стек (без Kafka)
make down        # Остановить
make logs        # Логи всех сервисов
make ps          # Статус контейнеров
make seed        # Загрузить демо-данные (python -m app.seed)
make clean       # Остановить + удалить volumes
```

### Прямые команды (без Make)

```bash
# Полный стек
docker compose -f infrastructure/docker-compose.yml up -d
docker compose -f infrastructure/docker-compose.yml down
docker compose -f infrastructure/docker-compose.yml logs -f
docker compose -f infrastructure/docker-compose.yml ps

# Dev-стек
docker compose -f infrastructure/docker-compose.dev.yml up -d
docker compose -f infrastructure/docker-compose.dev.yml down

# Конкретный сервис
docker compose -f infrastructure/docker-compose.yml logs -f backend
docker compose -f infrastructure/docker-compose.yml restart backend
docker compose -f infrastructure/docker-compose.yml exec backend bash

# Валидация
docker compose -f infrastructure/docker-compose.yml config
```

---

## Переменные окружения

Файл [`infrastructure/.env.example`](./.env.example) — шаблон. Скопировать в `.env` и заполнить.

| Переменная | Где используется | Описание |
|------------|------------------|----------|
| `DISCORD_CLIENT_ID` | backend, frontend, docker | Discord OAuth client |
| `DISCORD_CLIENT_SECRET` | backend, docker | Discord OAuth secret |
| `DISCORD_BOT_TOKEN` | backend (для бота), discord_bot | Discord bot token |
| `DISCORD_GUILD_ID` | discord_bot | ID сервера Discord для создания каналов |
| `DISCORD_CATEGORY_ID` | discord_bot | ID категории для голосовых каналов |
| `SECRET_KEY` | backend | JWT signing key (`openssl rand -hex 32`) |
| `DATABASE_URL` | backend | Async SQLAlchemy URL (по умолчанию указан в compose) |
| `REDIS_URL` | backend, parser_worker | Redis URL |
| `KAFKA_BOOTSTRAP_SERVERS` | backend, parser_worker, discord_bot | Kafka bootstrap |
| `NEXT_PUBLIC_API_URL` | frontend (build) | URL API в браузере |
| `NEXT_PUBLIC_WS_URL` | frontend (build) | URL WS в браузере |
| `NEXT_PUBLIC_DISCORD_CLIENT_ID` | frontend (build) | Discord client ID |
| `NEXT_PUBLIC_DISCORD_REDIRECT_URI` | frontend (build), backend | OAuth callback URL |

> ⚠️ Никогда не коммитить `.env` с реальными секретами. Использовать `.env.example` как шаблон.

---

## Volumes и персистентность

| Volume | Сервис | Назначение |
|--------|--------|------------|
| `postgres_data` | postgres | `/var/lib/postgresql/data` — данные БД |
| `redis_data` | redis | `/data` — снапшоты и AOF |
| `kafka_data` | kafka | `/var/lib/kafka/data` — логи Kafka |
| `../backend:/app` (bind) | backend | Hot reload при разработке |
| `../frontend:/app` (bind) | frontend | Hot reload + `node_modules` (anonymous) |

**Бэкап:**

```bash
# Дамп БД
docker compose exec postgres pg_dump -U pubg_finder pubg_finder > backup_$(date +%F).sql

# Восстановление
cat backup_2024-XX-XX.sql | docker compose exec -T postgres psql -U pubg_finder pubg_finder
```

---

## Healthchecks

| Сервис | Команда | Интервал | Назначение |
|--------|---------|----------|------------|
| `postgres` | `pg_isready -U pubg_finder` | 5s | БД готова принимать подключения |
| `redis` | `redis-cli ping` | 5s | Redis отвечает |
| `kafka` | ❌ нет | — | Только `service_started` |
| `backend` | ❌ нет | — | Нужен healthcheck (см. TODO) |
| `frontend` | ❌ нет | — | Нет необходимости |
| `nginx` | ❌ нет | — | Проверяется вручную |

---

## Логи и диагностика

```bash
# Все сервисы
docker compose logs -f

# Конкретный
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx
docker compose logs -f parser_worker
docker compose logs -f discord_bot

# Последние N строк
docker compose logs --tail=100 backend

# С timestamp
docker compose logs -f -t backend

# Только ошибки
docker compose logs backend | grep -i error
```

Логи nginx пишутся в `./nginx/logs/` (volume mount).

---

## Известные багфиксы

1. **CORS-дублирование**:
   - Nginx не должен добавлять CORS-заголовки.
   - CORS настраивается только в FastAPI (CORSMiddleware).
2. **WebSocket-проксирование**:
   - Frontend использует `NEXT_PUBLIC_WS_URL=ws://nginx/ws`.
   - Nginx проксирует `/ws/` с `Upgrade`/`Connection: upgrade`.
3. **Порт 3000 для nginx** — продублирован server-block (ports 80 и 3000) для удобства dev-доступа.

---

## Что нужно доработать

- [ ] **Добавить healthcheck** для `backend` (`curl -f http://localhost:8000/health`).
- [ ] **Добавить healthcheck** для `kafka` (`kafka-broker-api-versions --bootstrap-server localhost:9092`).
- [ ] **Kafka-init контейнер** — автоматическое создание топиков (`match_created`, `match_completed`) при первом старте.
- [ ] **HTTPS** — настроить `certbot` или self-signed сертификаты в nginx, переключить `listen 443 ssl`.
- [ ] **Resource limits** — добавить `mem_limit`, `cpus`, `pids_limit` для каждого контейнера.
- [ ] **Read-only root filesystem** где возможно (особенно для parser_worker, discord_bot).
- [ ] **Backup-сервис** — cron + `pg_dump` в S3/Azure Blob.
- [ ] **CI/CD** — GitHub Actions / GitLab CI для билда и тестов.
- [ ] **Мониторинг** — Prometheus + Grafana (или Datadog / New Relic).
- [ ] **Логи в ELK/Loki** — structured JSON-логи, Filebeat/Fluentd.
- [ ] **Production override** — `docker-compose.prod.yml` с другими credentials, restart policies, registry.
- [ ] **Secrets management** — перенести `.env` в Vault / AWS Secrets Manager / Docker secrets.
- [ ] **Сеть** — выделить `frontend`, `backend`, `db` в отдельные networks для security isolation.
- [ ] **Reverse proxy для WebSocket** на отдельный upstream с балансировкой (для будущего scaling).
- [ ] **Nginx config** — вынести в include-файлы (`/etc/nginx/conf.d/*.conf`) для упрощения поддержки.
- [ ] **Kafka** — увеличить `KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR` для multi-broker.
- [ ] **Makefile** — добавить команды: `migrate`, `test`, `lint`, `build`, `rebuild-backend`, `shell-backend`.
- [ ] **Документация** — описать flow деплоя в production (k8s, terraform, ansible).
- [ ] **Compose profiles** — `docker compose --profile dev` / `prod` / `microservices`.
- [ ] **Tracing** — Jaeger / Zipkin для distributed tracing.
- [ ] **Pre-commit** — `hadolint` для Dockerfile, `dockerfilelint` для compose.
