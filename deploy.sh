#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  PromoUork - Script de Deploy${NC}"
echo -e "${GREEN}========================================${NC}"

if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}Aviso: Algumas operações podem precisar de sudo${NC}"
fi

check_dependencies() {
    echo -e "\n${YELLOW}Verificando dependências...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Docker não encontrado. Instale o Docker primeiro.${NC}"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${RED}Docker Compose não encontrado. Instale o Docker Compose primeiro.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Todas as dependências estão instaladas${NC}"
}

setup_directories() {
    echo -e "\n${YELLOW}Criando diretórios necessários...${NC}"
    mkdir -p certbot/conf
    mkdir -p certbot/www
    echo -e "${GREEN}✓ Diretórios criados${NC}"
}

start_services() {
    echo -e "\n${YELLOW}Iniciando serviços...${NC}"
    docker compose -f docker-compose.prod.yml up -d --build
    echo -e "${GREEN}✓ Serviços iniciados${NC}"
}

obtain_ssl() {
    local domain="promouork.com.br"
    local email="${1:-}"
    
    if [ -z "$email" ]; then
        echo -e "${RED}Uso: $0 ssl <email>${NC}"
        echo -e "Exemplo: $0 ssl admin@promouork.com.br"
        exit 1
    fi
    
    echo -e "\n${YELLOW}Obtendo certificados SSL para ${domain} (webroot)...${NC}"
    
    # Nginx PRECISA estar rodando para servir o desafio
    echo -e "${YELLOW}Garantindo que Nginx está rodando...${NC}"
    docker compose -f docker-compose.prod.yml up -d nginx
    
    sleep 3
    
    # Obter certificado usando webroot (Nginx serve os arquivos de desafio)
    echo -e "${YELLOW}Executando Certbot...${NC}"
    docker compose -f docker-compose.prod.yml run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$email" \
        --agree-tos \
        --no-eff-email \
        --non-interactive \
        --verbose \
        -d "$domain" \
        -d "www.$domain" \
        -d "api.$domain"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Certificados SSL obtidos com sucesso!${NC}"
        
        # Ativar configuração SSL
        echo -e "\n${YELLOW}Ativando configuração SSL...${NC}"
        cp nginx/nginx.ssl.conf nginx/nginx.conf
        
        # Recarregar Nginx para aplicar SSL
        echo -e "${YELLOW}Recarregando Nginx...${NC}"
        docker compose -f docker-compose.prod.yml exec nginx nginx -s reload || \
            docker compose -f docker-compose.prod.yml restart nginx
        
        echo -e "${GREEN}✓ SSL configurado com sucesso!${NC}"
    else
        echo -e "${RED}Erro ao obter certificados.${NC}"
        echo -e "${YELLOW}Verifique:${NC}"
        echo -e "  1. DNS configurado para todos os domínios (A records para @, www, api)"
        echo -e "  2. Porta 80 liberada no firewall"
        echo -e "  3. Nginx está rodando e acessível"
        exit 1
    fi
}

# Função para renovar certificados
renew_ssl() {
    echo -e "\n${YELLOW}Renovando certificados SSL...${NC}"
    docker compose -f docker-compose.prod.yml run --rm certbot renew
    docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
    echo -e "${GREEN}✓ Certificados renovados${NC}"
}

# Função para ver logs
show_logs() {
    local service="${1:-}"
    if [ -z "$service" ]; then
        docker compose -f docker-compose.prod.yml logs -f
    else
        docker compose -f docker-compose.prod.yml logs -f "$service"
    fi
}

# Função para parar serviços
stop_services() {
    echo -e "\n${YELLOW}Parando serviços...${NC}"
    docker compose -f docker-compose.prod.yml down
    echo -e "${GREEN}✓ Serviços parados${NC}"
}

# Função para mostrar status
show_status() {
    echo -e "\n${YELLOW}Status dos serviços:${NC}"
    docker compose -f docker-compose.prod.yml ps
}

# Função de ajuda
show_help() {
    echo -e "
${GREEN}Uso:${NC} $0 <comando> [opções]

${GREEN}Comandos disponíveis:${NC}
  ${YELLOW}setup${NC}       - Configura o ambiente (cria .env e diretórios)
  ${YELLOW}start${NC}       - Inicia todos os serviços
  ${YELLOW}stop${NC}        - Para todos os serviços
  ${YELLOW}restart${NC}     - Reinicia todos os serviços
  ${YELLOW}status${NC}      - Mostra status dos serviços
  ${YELLOW}logs${NC}        - Mostra logs (opcional: nome do serviço)
  ${YELLOW}ssl${NC}         - Obtém certificados SSL (requer email)
  ${YELLOW}renew${NC}       - Renova certificados SSL
  ${YELLOW}help${NC}        - Mostra esta ajuda

${GREEN}Exemplos:${NC}
  $0 setup                    # Configura o ambiente
  $0 start                    # Inicia os serviços
  $0 ssl admin@example.com    # Obtém certificados SSL
  $0 logs backend             # Mostra logs do backend

${GREEN}Configuração DNS necessária:${NC}
  Tipo A: @ -> IP_DA_VPS
  Tipo A: api -> IP_DA_VPS
  Tipo A: www -> IP_DA_VPS (opcional)
"
}

# Main
case "${1:-help}" in
    setup)
        check_dependencies
        setup_directories
        echo -e "\n${GREEN}Setup concluído!${NC}"
        echo -e "${YELLOW}Próximos passos:${NC}"
        echo -e "1. Edite o arquivo .env com suas configurações"
        echo -e "2. Configure o DNS apontando para o IP desta VPS"
        echo -e "3. Execute: $0 start"
        echo -e "4. Execute: $0 ssl seu@email.com"
        ;;
    start)
        check_dependencies
        start_services
        show_status
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        start_services
        show_status
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs "${2:-}"
        ;;
    ssl)
        obtain_ssl "${2:-}"
        ;;
    renew)
        renew_ssl
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Comando desconhecido: $1${NC}"
        show_help
        exit 1
        ;;
esac
