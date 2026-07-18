# Frontend (Next.js 14)

Веб-интерфейс **PUBG Team Finder** на Next.js 14 (App Router).

> Главный README проекта: [`../README.md`](../README.md)  
> Backend API: [`../backend/README.md`](../backend/README.md)

---

## Содержание

1. [Описание](#описание)
2. [Технологический стек](#технологический-стек)
3. [Структура каталогов](#структура-каталогов)
4. [Маршруты (App Router)](#маршруты-app-router)
5. [State Management (Zustand)](#state-management-zustand)
6. [API Client](#api-client)
7. [WebSocket клиент](#websocket-клиент)
8. [Middleware (аутентификация)](#middleware-аутентификация)
9. [Локализация (next-intl)](#локализация-next-intl)
10. [Локальный запуск](#локальный-запуск)
11. [Тестирование](#тестирование)
12. [E2E тесты (Playwright)](#e2e-тесты-playwright)
13. [Переменные окружения](#переменные-окружения)
14. [Что нужно доработать](#что-нужно-доработать)

---

## Описание

Next.js приложение реализует:

- **SSR/SSG** для лендинга и публичных страниц.
- **App Router** (Next.js 14) с серверными и клиентскими компонентами.
- **OAuth callback** через Next.js API routes (`/api/auth/callback`).
- **Zustand store** для пользователя, токенов, списка приглашённых игроков (с persist в `localStorage`).
- **React Query** для server state (кеш, рефетч, инвалидация).
- **WebSocket клиент** (`useWebsocket` hook) с автоматическим реконнектом и heartbeat.
- **Toast Provider** для уведомлений (success, error, warning, info).
- **Middleware** для защиты приватных маршрутов через cookie-сессию.
- **i18n** через `next-intl` (русский по умолчанию).
- **Tailwind CSS** для стилей + кастомные UI-компоненты.
- **TypeScript** в strict-режиме (`any` запрещён).

Контейнер: `pubg_finder_frontend`. Порт: `3000`.

---

## Технологический стек

| Компонент | Версия | Назначение |
|-----------|--------|------------|
| Next.js | 14.1.0 | React-фреймворк (App Router) |
| React | 18.2.0 | UI |
| TypeScript | 5.3.3 | Строгая типизация |
| Tailwind CSS | 3.4.1 | Утилитарные стили |
| Zustand | 4.5.0 | Глобальный state |
| @tanstack/react-query | 5.17.9 | Server state |
| axios | 1.6.5 | HTTP-клиент |
| next-intl | 3.5.0 | Интернационализация |
| lucide-react | 0.312.0 | Иконки |
| clsx | 2.1.0 | Conditional className |
| tailwind-merge | 2.2.0 | Merge Tailwind classes |
| Vitest | 4.1.5 | Unit-тесты |
| @playwright/test | 1.59.1 | E2E-тесты |
| ESLint | 8.56.0 | Линтер |
| PostCSS | 8.4.33 | CSS post-processor |
| Autoprefixer | 10.4.17 | CSS вендорные префиксы |

Полный список: [`package.json`](./package.json).

---

## Структура каталогов

```
frontend/
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── layout.tsx                    # Root layout (ClientProviders, Header)
│   │   ├── page.tsx                      # Landing + Discord OAuth кнопка
│   │   ├── globals.css                   # Глобальные стили
│   │   │
│   │   ├── api/auth/                     # Next.js API routes
│   │   │   └── callback/                 # Discord OAuth callback
│   │   │
│   │   ├── dashboard/                    # Поиск игроков, фильтры
│   │   ├── groups/                       # Список и настройки групп
│   │   │   └── [groupId]/settings/
│   │   ├── matches/                      # Список и детали матчей
│   │   │   └── [matchId]/
│   │   ├── players/                      # Профили игроков
│   │   │   └── [id]/
│   │   ├── profile/                      # Профиль текущего пользователя
│   │   ├── rating/                       # Форма оценки игроков
│   │   │   └── [id]/
│   │   └── create-match/                 # Создание матча
│   │
│   ├── components/
│   │   ├── app-layout.tsx                # Layout с навигацией
│   │   ├── features/                     # Бизнес-компоненты
│   │   │   ├── UserCard.tsx              # Карточка игрока + кнопка приглашения
│   │   │   ├── GroupCard.tsx             # Карточка группы
│   │   │   ├── FilterPanel.tsx           # Фильтры поиска (ранг, регион, ...)
│   │   │   ├── RatingForm.tsx            # Форма оценки после матча
│   │   │   ├── Header.tsx                # Шапка с навигацией и аватаром
│   │   │   └── ...
│   │   ├── providers/
│   │   │   ├── ClientProviders.tsx       # QueryClient, Toast, WebSocket
│   │   │   └── ToastProvider.tsx         # Toast notifications
│   │   └── ui/                           # Базовые UI-компоненты
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Spinner.tsx
│   │       ├── InfiniteScroll.tsx
│   │       └── ...
│   │
│   ├── hooks/
│   │   └── use-websocket.ts              # WS клиент с реконнектом
│   │
│   ├── i18n/                             # Конфигурация next-intl
│   │   ├── ru.json                       # Русская локализация
│   │   └── ...
│   │
│   ├── lib/                              # Утилиты
│   │   └── utils.ts                      # cn(), форматирование
│   │
│   ├── services/
│   │   └── api.ts                        # Axios + авто-refresh + API методы
│   │
│   ├── stores/
│   │   └── app-store.ts                  # Zustand store
│   │
│   ├── middleware.ts                     # Защита роутов через cookie
│   │
│   └── __tests__/                        # Unit-тесты (Vitest)
│
├── e2e/                                  # E2E тесты (Playwright)
│   └── app.spec.ts                       # notifications, match, rating
│
├── public/                               # Статические файлы
├── Dockerfile                            # node:20-alpine + npm run dev
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── playwright.config.ts
├── vitest.config.ts
└── package.json
```

---

## Маршруты (App Router)

| Путь | Защита | Описание |
|------|--------|----------|
| `/` | Публичный | Landing с кнопкой Discord OAuth |
| `/api/auth/callback` | Публичный | Обработка OAuth callback |
| `/dashboard` | 🔒 Приватный | Поиск игроков, фильтры, suggestions |
| `/groups` | 🔒 Приватный | Список групп пользователя |
| `/groups/[groupId]/settings` | 🔒 Приватный | Управление группой |
| `/matches` | 🔒 Приватный | Список матчей пользователя |
| `/matches/[matchId]` | 🔒 Приватный | Детали матча, кнопки: завершить, пригласить, запросить подтверждение |
| `/matches/[matchId]/invite` | 🔒 Приватный | Приглашение через Discord |
| `/players/[id]` | 🔒 Приватный | Профиль игрока с рейтингом |
| `/profile` | 🔒 Приватный | Профиль текущего пользователя |
| `/rating/[id]` | 🔒 Приватный | Форма оценки после завершённого матча |
| `/create-match` | 🔒 Приватный | Создание нового матча |

🔒 = требуется cookie `pubg-auth-session` (см. [Middleware](#middleware-аутентификация)).

---

## State Management (Zustand)

Файл: [`src/stores/app-store.ts`](./src/stores/app-store.ts)

```typescript
interface AppState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  invitedPlayers: string[];

  setUser: (user: User) => void;
  setTokens: (access: string, refresh: string) => void;
  clearAuth: () => void;
  invitePlayer: (id: string) => void;
  removeInvitedPlayer: (id: string) => void;
  clearInvites: () => void;
}
```

Хранилище: `localStorage` ключ `pubg-finder-storage` (через `zustand/middleware/persist`).

Версионирование: число в `version` для миграций схемы store.

---

## API Client

Файл: [`src/services/api.ts`](./src/services/api.ts)

- Axios instance с `baseURL = process.env.NEXT_PUBLIC_API_URL`.
- Interceptor на `401`: автоматический вызов `/api/v1/auth/refresh` и повтор запроса.
- При неудаче refresh — очистка store и редирект на `/`.
- Все методы экспортируются через единый объект `api`:
  - `api.auth.discord()`, `api.auth.callback(code)`, `api.auth.refresh()`, `api.auth.logout()`
  - `api.users.me()`, `api.users.update(data)`, `api.users.search(params)`, `api.users.get(id)`
  - `api.groups.list()`, `api.groups.create(data)`, ...
  - `api.matches.list()`, `api.matches.create(data)`, `api.matches.complete(id)`, ...
  - `api.ratings.create(data)`, `api.ratings.forUser(id)`
  - `api.notifications.list()`, `api.notifications.unreadCount()`, `api.notifications.markRead(id)`
  - `api.parser.player(username)`

---

## WebSocket клиент

Файл: [`src/hooks/use-websocket.ts`](./src/hooks/use-websocket.ts)

```typescript
const { isConnected, sendMessage } = useWebSocket(userId, {
  onNotification: (msg) => showToast({ type: ..., title: ..., body: msg.message }),
  onError: (e) => console.error(e),
});
```

**Особенности:**

- URL: `${process.env.NEXT_PUBLIC_WS_URL}/notifications/${userId}`.
- **Heartbeat:** каждые 30 секунд отправляется `{"type": "ping"}` (сервер отвечает `{"type": "pong"}`).
- **Автореконнект:** экспоненциальный backoff (1s → 2s → 4s → ... → max 30s), до 10 попыток.
- **Cleanup:** при unmount закрывает соединение с кодом 1000.
- Используется в [`ClientProviders`](./src/components/providers/ClientProviders.tsx) для глобальной подписки.

**События сервера:**

```typescript
type NotificationEvent =
  | { event_type: "match_invite_sent", match_id: string, from_user: string }
  | { event_type: "invite_accepted", match_id: string, user_id: string }
  | { event_type: "match_left", match_id: string, user_id: string }
  | { event_type: "match_cancelled", match_id: string }
  | { event_type: "participant_removed", match_id: string, user_id: string }
  | { event_type: "confirmation_requested", match_id: string }
  | { event_type: "participant_ready", match_id: string, user_id: string };
```

В `ClientProviders` они маппятся в toast-уведомления.

---

## Middleware (аутентификация)

Файл: [`src/middleware.ts`](./src/middleware.ts)

| Тип роута | Список | Логика |
|-----------|--------|--------|
| Публичный | `/`, `/api/auth/callback` | Всегда доступны |
| Приватный | `/dashboard`, `/profile`, `/groups`, `/matches`, `/create-match` | Редирект на `/` если нет cookie `pubg-auth-session` |
| Корневой `/` | — | Если есть session → редирект на `/dashboard` |

Cookie устанавливается после успешного OAuth callback (в Next.js API route).

`matcher` исключает статику (`_next/static`, `_next/image`, `favicon.ico`, изображения).

---

## Локализация (next-intl)

- **Поддерживаемые языки:** русский (primary), английский (планируется).
- Файлы локалей: [`src/i18n/`](./src/i18n/) — `ru.json` и др.
- Конфигурация в `next.config.js` (плагин `next-intl`).
- **Запрещён хардкод строк в компонентах** — все пользовательские строки через `useTranslations()` / `getTranslations()`.
- Дата/время в локали пользователя через `Intl.DateTimeFormat`.

---

## Локальный запуск

### Вариант 1: Через Docker Compose (рекомендуется)

```bash
cd ../infrastructure
cp .env.example .env
# отредактируйте .env (DISCORD_*, NEXT_PUBLIC_*)
docker compose up -d frontend
docker compose logs -f frontend
```

Frontend будет доступен на `http://localhost:3000` (напрямую) или `http://localhost` (через nginx).

### Вариант 2: Локально без Docker

Требуется: Node.js 20+.

```bash
cd frontend
npm install --legacy-peer-deps

# Установить переменные окружения
export NEXT_PUBLIC_API_URL=http://localhost:8000
export NEXT_PUBLIC_WS_URL=ws://localhost/ws
export NEXT_PUBLIC_DISCORD_CLIENT_ID=...
export NEXT_PUBLIC_DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Запустить dev-сервер
npm run dev

# Сборка production
npm run build
npm run start
```

Frontend dev-сервер: `http://localhost:3000`.

---

## Тестирование

### Unit-тесты (Vitest)

```bash
npm run test                 # Watch mode
npx vitest run               # Single run
npx vitest run --coverage    # С покрытием
```

Конфиг: [`vitest.config.ts`](./vitest.config.ts). Тесты в [`src/__tests__/`](./src/__tests__/).

### Линтинг

```bash
npm run lint
```

Конфиг: `.eslintrc.json` (extends `next/core-web-vitals`).

---

## E2E тесты (Playwright)

Конфиг: [`playwright.config.ts`](./playwright.config.ts). Тесты в [`e2e/`](./e2e/).

```bash
# Установить браузеры (один раз)
npx playwright install --with-deps chromium

# Запустить все тесты
npx playwright test

# С UI
npx playwright test --ui

# С генерацией отчёта
npx playwright show-report
```

### Покрытые сценарии ([`e2e/app.spec.ts`](./e2e/app.spec.ts))

1. Отображение toast-уведомлений через WebSocket.
2. Создание матча и появление кнопки "Завершить".
3. Отправка оценки и проверка success-toast.
4. Graceful degradation: парсер недоступен → UI показывает мок-данные.

---

## Переменные окружения

| Переменная | Обязательна | Пример | Описание |
|------------|-------------|--------|----------|
| `NEXT_PUBLIC_API_URL` | ✅ | `http://nginx/api` или `http://localhost:8000` | Базовый URL API |
| `NEXT_PUBLIC_WS_URL` | ✅ | `ws://nginx/ws` или `ws://localhost/ws` | Базовый URL WebSocket |
| `NEXT_PUBLIC_DISCORD_CLIENT_ID` | ✅ | `<your_discord_client_id>` | Discord OAuth client |
| `NEXT_PUBLIC_DISCORD_REDIRECT_URI` | ✅ | `http://localhost:3000/api/auth/callback` | OAuth callback URL |

> ⚠️ Переменные с префиксом `NEXT_PUBLIC_` встраиваются в bundle на этапе сборки. Изменения требуют пересборки контейнера.

---

## Прочее

- **Стили:** Tailwind CSS, кастомные токены в [`tailwind.config.js`](./tailwind.config.js).
- **Иконки:** `lucide-react` (дерево шейкаемое).
- **Шрифты:** стандартные системные (можно добавить `next/font`).
- **Проксирование:** Nginx проксирует `/` и `/api/auth/callback` на frontend:3000 (см. [`../infrastructure/README.md`](../infrastructure/README.md#nginx-маршрутизация)).

---

## Что нужно доработать

- [ ] **Storybook** для компонентов из `src/components/ui/` (Button, Card, Spinner, InfiniteScroll).
- [ ] **Error Boundary** на верхнем уровне `app/layout.tsx` для graceful UI при ошибках рендера.
- [ ] **Loading skeletons** вместо `<Spinner />` на страницах с данными (dashboard, matches, profile).
- [ ] **Unit-тесты** для хуков: `use-websocket.ts` (mock WebSocket), `use-user.ts`, `use-matches.ts` (если есть).
- [ ] **Unit-тесты** для Zustand store: `app-store.ts` (auth flow, invite flow).
- [ ] **Unit-тесты** для бизнес-компонентов: `UserCard`, `GroupCard`, `RatingForm` (React Testing Library).
- [ ] **A11y**: проверить aria-атрибуты в формах (`RatingForm`, `FilterPanel`), фокус-стили, навигация с клавиатуры.
- [ ] **i18n**: добавить английскую локализацию (`en.json`) — сейчас только `ru.json`.
- [ ] **PWA manifest** + service worker (опционально).
- [ ] **Адаптивность**: протестировать mobile/tablet на ключевых страницах.
- [ ] **`next.config.js`**: добавить `output: 'standalone'` для оптимизации production Docker-образа.
- [ ] **`next.config.js`**: добавить `images.domains` (или `remotePatterns`) если планируются аватары с Discord CDN.
- [ ] **Header**: добавить badge с количеством непрочитанных уведомлений (есть API, нет UI).
- [ ] **Empty states**: для пустых списков (matches, groups, notifications) — полноценные компоненты с CTA.
- [ ] **Pre-commit hooks**: `eslint --fix`, `prettier --write`.
- [ ] **Bundle analyzer**: `@next/bundle-analyzer` для оптимизации размера.
- [ ] **Lighthouse**: целевые показатели (perf > 90, a11y > 95, SEO > 95).
- [ ] **SEO**: `generateMetadata()` для публичных страниц.
- [ ] **Серверные компоненты**: мигрировать dashboard/matches на RSC где возможно.
- [ ] **Streaming**: использовать `<Suspense>` + `loading.tsx` для data fetching.
- [ ] **CSRF**: проверить защиту от CSRF в формах (кроме OAuth).

---

## Полезные команды

```bash
# Перезапуск dev-сервера
docker compose restart frontend

# Логи
docker compose logs -f frontend

# Сборка production-образа
docker build -t pubg-frontend:prod .

# Типы
npx tsc --noEmit
```
