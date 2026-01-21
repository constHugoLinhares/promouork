.PHONY: start start-db start-all start-evolution restart restart-evolution drop drop-evolution help prod prod-stop prod-rebuild prod-logs ssl ssl-renew

# Comando padrão
help:
	@echo "Comandos disponíveis:"
	@echo ""
	@echo "  Desenvolvimento:"
	@echo "  make start          - Inicia frontend e backend"
	@echo "  make start-db       - Inicia o banco de dados"
	@echo "  make start-redis    - Inicia o Redis"
	@echo "  make start-all      - Inicia todos os serviços (postgres, redis, backend, frontend)"
	@echo "  make start-evolution - Inicia os serviços da Evolution API"
	@echo "  make restart        - Reinicia todos os serviços do compose principal"
	@echo "  make restart-evolution - Reinicia os serviços da Evolution"
	@echo "  make drop           - Remove todos os containers e volumes do compose principal"
	@echo "  make drop-evolution - Remove todos os containers e volumes da Evolution"
	@echo ""
	@echo "  Produção:"
	@echo "  make prod           - Inicia ambiente de produção com Nginx"
	@echo "  make prod-stop      - Para ambiente de produção"
	@echo "  make prod-rebuild   - Rebuild sem cache e inicia produção"
	@echo "  make prod-logs      - Mostra logs da produção"
	@echo "  make ssl            - Obtém certificados SSL (requer EMAIL=seu@email.com)"
	@echo "  make ssl-renew      - Renova certificados SSL"

# Inicia apenas frontend e backend (sem o banco)
start:
	docker-compose up -d frontend backend

# Inicia o banco de dados
start-db:
	docker-compose up -d postgres

# Inicia o Redis
start-redis:
	docker-compose up -d redis

# Inicia todos os serviços do compose principal
start-all:
	docker-compose up -d

# Inicia os serviços da Evolution
start-evolution:
	docker-compose -f docker-compose.evolution.yml up -d

# Reinicia todos os serviços do compose principal
restart:
	docker-compose restart

# Reinicia os serviços da Evolution
restart-evolution:
	docker-compose -f docker-compose.evolution.yml restart

# Remove todos os containers, volumes e networks do compose principal
drop:
	docker-compose down -v --remove-orphans

# Remove todos os containers, volumes e networks da Evolution
drop-evolution:
	docker-compose -f docker-compose.evolution.yml down -v --remove-orphans

# ==================== PRODUÇÃO ====================

# Inicia ambiente de produção com Nginx
prod:
	@./deploy.sh start

# Para ambiente de produção
prod-stop:
	@./deploy.sh stop

# Rebuild sem cache e inicia produção
prod-rebuild:
	docker compose -f docker-compose.prod.yml build --no-cache
	docker compose -f docker-compose.prod.yml up -d

# Mostra logs da produção
prod-logs:
	@./deploy.sh logs

# Obtém certificados SSL (uso: make ssl EMAIL=seu@email.com)
ssl:
ifndef EMAIL
	@echo "Erro: EMAIL é obrigatório"
	@echo "Uso: make ssl EMAIL=seu@email.com"
	@exit 1
endif
	@./deploy.sh ssl $(EMAIL)

# Renova certificados SSL
ssl-renew:
	@./deploy.sh renew
