# AliExpress Integration Module

Este módulo fornece integração com a API do AliExpress para autenticação OAuth e geração de links de afiliados.

## Instalação de Dependências

Antes de usar este módulo, instale as dependências necessárias:

```bash
cd backend
pnpm add @nestjs/axios axios
```

## Configuração

Configure as seguintes variáveis de ambiente no arquivo `.env`:

```env
ALI_APP_KEY=your_app_key_here
ALI_APP_SECRET=your_app_secret_here
ALI_REDIRECT_URI=http://localhost:3000/integrations/callback  # Opcional
FRONTEND_URL=http://localhost:3000  # Opcional, usado para construir redirect_uri padrão
```

## Endpoints

### GET /aliexpress/authorize
Retorna a URL de autorização OAuth do AliExpress.

**Query Parameters:**
- `redirectUri` (opcional): URI de callback customizada

**Resposta:**
```json
{
  "url": "https://auth.aliexpress.com/oauth/authorize?...",
  "state": "uuid-gerado"
}
```

### POST /aliexpress/callback
Troca o código de autorização por um access_token.

**Body:**
```json
{
  "code": "authorization_code",
  "redirectUri": "http://localhost:3000/integrations/callback"  // opcional
}
```

**Resposta:**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600
}
```

## Uso no Frontend

1. Obtenha a URL de autorização:
```typescript
const response = await api.get('/aliexpress/authorize');
const { url } = response.data;
window.location.href = url;
```

2. Após o usuário autorizar, o AliExpress redireciona para `/integrations/callback?code=...&state=...`

3. A página de callback automaticamente troca o código por token chamando `POST /aliexpress/callback`

## Próximos Passos

- [ ] Salvar tokens no banco de dados
- [ ] Implementar refresh token automático
- [ ] Adicionar endpoint para desconectar integração
- [ ] Implementar busca de produtos via API do AliExpress

