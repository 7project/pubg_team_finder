.PHONY: help up down logs ps migrate seed test lint clean build

PROJECT_DIR := $(shell pwd)
INFRA_DIR := $(PROJECT_DIR)/infrastructure
DOCKER_FILE := $(INFRA_DIR)/docker-compose.dev.yml

help:
	@echo "PUBG Team Finder - Команды"
	@echo "  make up        - Запустить (без Kafka)"
	@echo "  make down      - Остановить"
	@echo "  make logs      - Логи"
	@echo "  make ps        - Статус контейнеров"
	@echo "  make seed      - Тестовые данные"
	@echo "  make clean     - Очистка"

up:
	@echo "Запуск (упрощённый - без Kafka)..."
	docker-compose -f $(DOCKER_FILE) up -d
	@echo "Frontend: http://localhost:3000 | Backend: http://localhost:8000"

down:
	docker-compose -f $(DOCKER_FILE) down

logs:
	docker-compose -f $(DOCKER_FILE) logs -f

ps:
	docker-compose -f $(DOCKER_FILE) ps

seed:
	docker-compose -f $(DOCKER_FILE) exec -T backend python -m app.seed

clean:
	docker-compose -f $(DOCKER_FILE) down -v