.PHONY: help migrate upgrade seed test-backend test-frontend test install

help:
	@echo "PUBG Team Finder - Команды разработки"
	@echo "  make migrate       - Создание новой миграции (внутри Docker)"
	@echo "  make upgrade       - Применение миграций (внутри Docker)"
	@echo "  make seed          - Добавление тестовых данных (внутри Docker)"
	@echo "  make test-backend  - Тесты бэкенда (внутри Docker)"
	@echo "  make test-frontend - Тесты фронтенда"
	@echo "  make test          - Все тесты"
	@echo "  make docker-build  - Сборка Docker образов"
	@echo "  make docker-up     - Запуск всех контейнеров"
	@echo "  make docker-down   - Остановка всех контейнеров"
	@echo "  make docker-logs   - Логи всех контейнеров"
	@echo "  make docker-restart- Запуск с пересборкой"
	@echo "  make full-start    - Полный запуск (build+up+seed)"

migrate:
	docker-compose -f infrastructure/docker-compose.yml run --rm backend alembic revision --autogenerate -m "$(m)"

upgrade:
	docker-compose -f infrastructure/docker-compose.yml run --rm alembic-migrate alembic upgrade head

downgrade:
	docker-compose -f infrastructure/docker-compose.yml run --rm alembic-migrate alembic downgrade -1

seed:
	docker-compose -f infrastructure/docker-compose.yml exec backend python -m app.seed

test-backend:
	docker-compose -f infrastructure/docker-compose.yml exec backend pytest -v || true

test-frontend:
	cd frontend && npm test

test: test-backend test-frontend

install:
	pip install -r backend/requirements.txt
	cd frontend && npm install

# Docker commands
docker-build:
	docker-compose -f infrastructure/docker-compose.yml build --no-cache

docker-build-fast:
	docker-compose -f infrastructure/docker-compose.yml build

docker-up:
	docker-compose -f infrastructure/docker-compose.yml up -d

docker-down:
	docker-compose -f infrastructure/docker-compose.yml down

docker-logs:
	docker-compose -f infrastructure/docker-compose.yml logs -f

docker-restart:
	docker-compose -f infrastructure/docker-compose.yml down -v
	docker-compose -f infrastructure/docker-compose.yml build --no-cache
	docker-compose -f infrastructure/docker-compose.yml up -d

# Re-render (rebuild) all containers
docker-rebuild-backend:
	docker-compose -f infrastructure/docker-compose.yml stop backend
	docker-compose -f infrastructure/docker-compose.yml rm -f backend
	docker-compose -f infrastructure/docker-compose.yml build --no-cache backend
	docker-compose -f infrastructure/docker-compose.yml up -d backend

docker-rebuild-frontend:
	docker-compose -f infrastructure/docker-compose.yml stop frontend
	docker-compose -f infrastructure/docker-compose.yml rm -f frontend
	docker-compose -f infrastructure/docker-compose.yml build --no-cache frontend
	docker-compose -f infrastructure/docker-compose.yml up -d frontend

docker-rebuild-all: docker-rebuild-backend docker-rebuild-frontend
	@echo "Все контейнеры пересобраны и запущены"

# Full application startup
full-start: docker-down
	docker-compose -f infrastructure/docker-compose.yml build --no-cache
	docker-compose -f infrastructure/docker-compose.yml up -d
	@echo "Ожидание запуска сервисов..."
	sleep 15
	@echo "Добавление тестовых данных..."
	docker-compose -f infrastructure/docker-compose.yml exec backend python -m app.seed || true
	@echo ""
	@echo "========================================="
	@echo "PUBG Team Finder запущен!"
	@echo "Frontend: http://localhost (порт 80)"
	@echo "Backend:  http://localhost/api/"
	@echo "========================================="

# Quick start (without rebuild)
quick-start: docker-down
	docker-compose -f infrastructure/docker-compose.yml up -d
	@echo "Ожидание запуска сервисов..."
	sleep 10
	@echo "PUBG Team Finder запущен!"
	@echo "Frontend: http://localhost (порт 80)"
	@echo "Backend:  http://localhost/api/"
