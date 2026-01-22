# Promouork - Sistema de Gestão de Promoções

Sistema de painel administrativo para gerenciamento de posts de promoções com integração ao Telegram.

## Tecnologias

- **Backend**: NestJS com Prisma ORM
- **Frontend**: Next.js
- **Database**: PostgreSQL
- **Containerização**: Docker & Docker Compose

## Estrutura do Projeto

```
promouork/
├── backend/          # API NestJS
├── frontend/         # Next.js App
├── docker-compose.yml
└── .env.example
```

## Configuração e Instalação

1. Clone o repositório
2. Copie o arquivo `.env.example` para `.env` na raiz do projeto e configure as variáveis:
   - `DB_USER`: Usuário do PostgreSQL (padrão: postgres)
   - `DB_PASSWORD`: Senha do PostgreSQL (padrão: postgres)
   - `DB_NAME`: Nome do banco de dados (padrão: promouork)
   - `JWT_SECRET`: Chave secreta para JWT (altere em produção!)
   
   **Nota**: O token do bot do Telegram agora é configurado por canal através da interface web, não mais via variável de ambiente.

3. Execute o projeto com Docker usando o Makefile:

```bash
# Iniciar o banco de dados primeiro
make start-db

# Aguardar alguns segundos e então iniciar frontend e backend
make start
```

Ou use docker-compose diretamente:

```bash
docker-compose up -d
```

### Comandos Makefile disponíveis

- `make start` - Inicia frontend e backend (sem o banco)
- `make start-db` - Inicia o banco de dados
- `make restart` - Reinicia todos os serviços
- `make drop` - Remove todos os containers e volumes

O sistema irá:
- Criar o banco de dados PostgreSQL
- Executar as migrações do Prisma
- Executar o seed (criar usuário admin)
- Iniciar o backend na porta 3001
- Iniciar o frontend na porta 3000

## Funcionalidades

- ✅ Autenticação com JWT
- ✅ Gestão de usuários e troca de senha
- ✅ CRUD de posts de promoções
- ✅ Gestão de canais Telegram
- ✅ Sistema de templates de imagem personalizáveis
- ✅ Envio de mensagens para canais Telegram

## Seed

O sistema possui um seed que cria automaticamente:
- **Usuário administrador**:
  - Email: `admin@promouork.com`
  - Senha: `admin123`
- **Template padrão** com configuração inicial

**IMPORTANTE**: Altere a senha após o primeiro login através da página de Configurações!

## Estrutura de Funcionalidades

### Autenticação
- Login com email e senha
- JWT para autenticação de requisições
- Troca de senha no painel

### Posts
- Criar, editar e excluir posts
- Associar posts a múltiplos canais Telegram
- Mensagens personalizadas por post
- Publicação de posts para os canais selecionados

### Canais Telegram
- Gerenciar canais do Telegram
- Ativar/desativar canais
- Chat ID do canal (ex: @channelname ou -1001234567890)
- Configurar token do bot do Telegram por canal

### Templates
- Criar templates personalizados
- Definir template padrão
- Editor visual com canvas
- Configurar background, textos e posições
- Elementos posicionáveis (texto, imagens)

### Integração Telegram
- Envio automático de mensagens
- Suporte a imagens com legenda
- Status de envio (pending, sent, failed)

