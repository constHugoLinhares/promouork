# Sistema de Armazenamento de Imagens - R2 Cloudflare

## Visão Geral

O sistema utiliza **Cloudflare R2** para armazenar imagens de forma eficiente e escalável. As imagens são organizadas por usuário e tipo de conteúdo.

## Estrutura de Armazenamento

```
{bucket}/
  └── users/
      └── {userUuid}/
          ├── posts/
          │   └── {imageName}.png
          ├── templates/
          │   └── {imageName}.png
          └── ...
```

**Exemplo:**

```
my-bucket/users/123e4567-e89b-12d3-a456-426614174000/posts/post-abc123.png
```

## Fluxo de Upload

### Com Cloudflare Worker (Recomendado - Resolve CORS)

1. **Frontend gera imagem final** (template + overlay)
2. **Frontend solicita URL de upload** ao backend
3. **Backend retorna URL do worker** com path organizado
4. **Frontend faz POST para o worker** com a imagem e token JWT
5. **Worker valida token e faz upload** para R2 usando R2 bindings
6. **Worker retorna URL pública** da imagem
7. **Frontend envia URL final** ao backend ao salvar post

### Sem Worker (Fallback - Pode ter problemas de CORS)

1. **Frontend gera imagem final** (template + overlay)
2. **Frontend solicita presigned URL** ao backend
3. **Backend gera presigned URL** com path organizado
4. **Frontend faz upload direto** para R2 usando presigned URL (PUT)
5. **Frontend envia URL final** ao backend ao salvar post

## Variáveis de Ambiente

### Backend

Adicione estas variáveis no arquivo `.env` do backend:

```env
# R2 Cloudflare Configuration
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://your-bucket.r2.dev

# Cloudflare Worker (opcional, mas recomendado para resolver CORS)
WORKER_UPLOAD_URL=https://promouork.your-subdomain.workers.dev
```

**Onde encontrar:**

- `R2_ACCOUNT_ID`: No dashboard da Cloudflare, em R2 > Overview
- `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY`: Em R2 > Manage R2 API Tokens
- `R2_BUCKET_NAME`: Nome do bucket criado no R2
- `R2_PUBLIC_URL`: URL pública do bucket (configurar Custom Domain ou usar a URL padrão)
- `WORKER_UPLOAD_URL`: URL do worker após deploy (ex: `https://promouork.xxx.workers.dev`)

### Worker

O worker está configurado em `workers/upload-worker/promouork/wrangler.jsonc`:

- **R2 Binding**: O bucket R2 é vinculado ao worker via `r2_buckets` binding
- **Variáveis**: `R2_PUBLIC_URL` é configurada como variável de ambiente do worker

## Endpoints

### POST `/storage/presign-url`

Gera uma URL de upload (worker ou presigned URL) para upload de imagem.

**Request:**

```json
{
  "type": "post", // "post" | "template"
  "fileName": "image.png",
  "contentType": "image/png"
}
```

**Response (com worker):**

```json
{
  "uploadUrl": "https://promouork.xxx.workers.dev",
  "publicUrl": "https://promouork.xxx.workers.dev/users/.../posts/image.png",
  "expiresIn": 3600
}
```

**Nota**: A `publicUrl` retornada aponta para o próprio worker, não para o R2 diretamente. Isso permite acesso público às imagens mesmo que o bucket R2 seja privado.

**Response (sem worker - fallback):**

```json
{
  "uploadUrl": "https://promouork.xxx.r2.cloudflarestorage.com/...?X-Amz-Algorithm=...",
  "publicUrl": "https://your-bucket.r2.dev/users/.../posts/image.png",
  "expiresIn": 3600
}
```

### POST `{WORKER_UPLOAD_URL}` (Worker Endpoint - Upload)

Endpoint do Cloudflare Worker para upload de imagens. Este endpoint atua como proxy, resolvendo problemas de CORS.

**Request (FormData):**

- `file`: Arquivo de imagem (Blob/File)
- `userId`: UUID do usuário
- `type`: Tipo de imagem (`"post"` ou `"template"`)
- `fileName`: Nome do arquivo
- `contentType`: Content-Type da imagem (ex: `"image/png"`)
- `token`: Token JWT do usuário para autenticação

**Response:**

```json
{
  "publicUrl": "https://promouork.xxx.workers.dev/users/.../posts/image.png",
  "key": "users/.../posts/image.png"
}
```

**Nota**: A `publicUrl` retornada aponta para o próprio worker, não para o R2 diretamente. Isso permite acesso público às imagens mesmo que o bucket R2 seja privado.

### GET `{WORKER_UPLOAD_URL}/{key}` (Worker Endpoint - Servir Imagem)

Endpoint do Cloudflare Worker para servir imagens do R2 publicamente. Resolve o problema de acesso ao R2 privado.

**Request:**

```
GET https://promouork.xxx.workers.dev/users/xxx/posts/xxx.png
```

**Response:**

- Status: `200 OK`
- Body: Conteúdo binário da imagem
- Headers:
  - `Content-Type`: Tipo MIME da imagem (ex: `image/png`)
  - `Cache-Control`: `public, max-age=31536000` (cache por 1 ano)
  - `Access-Control-Allow-Origin: *` (CORS)

**Erros:**

- `404 Not Found`: Imagem não encontrada no R2
- `500 Internal Server Error`: Erro ao buscar imagem no R2

**Headers CORS:**

O worker retorna automaticamente os headers CORS necessários:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Fluxo Completo

### 1. Criação de Post com Template

1. Usuário seleciona template
2. Usuário adiciona imagem sobreposta
3. Usuário posiciona/redimensiona no preview
4. Ao salvar:
   - Frontend gera imagem final (template + overlay)
   - Frontend solicita presigned URL
   - Frontend faz upload direto para R2
   - Frontend envia URL ao backend
   - Backend salva apenas a URL

### 2. Criação de Post sem Template

1. Usuário seleciona imagem simples
2. Ao salvar:
   - Frontend detecta base64
   - Frontend faz upload para R2
   - Frontend envia URL ao backend

### 3. Edição de Post

- Se imagem for base64, faz upload antes de salvar
- Se já for URL, mantém como está

## Cloudflare Worker - Edge Service

### O que é?

O **Cloudflare Worker** é um serviço edge computing que executa código na borda da rede Cloudflare, próximo aos usuários. No contexto deste projeto, o worker atua como **proxy de upload**, resolvendo problemas de CORS ao fazer upload direto do frontend para R2.

### Por que usar o Worker?

1. **Resolve problemas de CORS**: O worker está no mesmo domínio Cloudflare, evitando bloqueios de CORS
2. **Performance**: Executa na edge, próximo aos usuários
3. **R2 Bindings nativos**: Acesso direto ao R2 via bindings, sem necessidade de credenciais
4. **Autenticação**: Valida tokens JWT antes de fazer upload
5. **Escalabilidade**: Automaticamente escalável com a infraestrutura Cloudflare

### Localização

O worker está localizado em: `workers/upload-worker/promouork/`

### Estrutura do Worker

```
workers/upload-worker/promouork/
├── src/
│   └── index.ts          # Código principal do worker
├── wrangler.jsonc        # Configuração do worker (R2 bindings, vars)
├── package.json          # Dependências
└── tsconfig.json         # Configuração TypeScript
```

### Configuração do Worker

O worker está configurado com:

1. **R2 Binding**: Vincula o bucket R2 diretamente ao worker

   ```jsonc
   "r2_buckets": [
     {
       "binding": "BUCKET",
       "bucket_name": "promouork"
     }
   ]
   ```

2. **Variáveis de Ambiente**: URL pública do R2
   ```jsonc
   "vars": {
     "R2_PUBLIC_URL": "https://promouork.xxx.r2.cloudflarestorage.com"
   }
   ```

### Deploy do Worker

Para fazer deploy do worker:

```bash
cd workers/upload-worker/promouork
npm run deploy
```

Após o deploy, copie a URL do worker e adicione como `WORKER_UPLOAD_URL` no `.env` do backend.

### Desenvolvimento Local

Para testar o worker localmente:

```bash
cd workers/upload-worker/promouork
npm run dev
```

O worker estará disponível em `http://localhost:8787` durante o desenvolvimento.

### Como Funciona

#### Upload de Imagens

1. **Frontend solicita URL de upload** ao backend
2. **Backend verifica se `WORKER_UPLOAD_URL` está configurado**
   - Se sim: retorna URL do worker
   - Se não: retorna presigned URL direta (fallback)
3. **Frontend detecta se é worker ou presigned URL**
   - Worker: faz POST com FormData contendo arquivo + metadados + token
   - Presigned URL: faz PUT direto (pode ter problemas de CORS)
4. **Worker valida token JWT** e faz upload para R2 usando binding
5. **Worker retorna URL pública** da imagem (URL do próprio worker, não do R2)

#### Serviço de Imagens (GET)

1. **Cliente (navegador, Telegram, etc.) solicita imagem** via URL do worker
   - Exemplo: `https://promouork.xxx.workers.dev/users/xxx/posts/xxx.png`
2. **Worker busca imagem no R2** usando o binding
3. **Worker retorna imagem** com headers apropriados:
   - CORS headers (permite acesso de qualquer origem)
   - Content-Type correto
   - Cache-Control (cache por 1 ano)

**Importante**: O worker serve as imagens publicamente, resolvendo o problema de acesso ao R2 privado. As URLs geradas apontam para o worker, não para o R2 diretamente.

### Segurança

- ✅ Validação de token JWT antes de fazer upload
- ✅ Organização por usuário (`users/{userId}/...`)
- ✅ Validação de campos obrigatórios
- ✅ Tratamento de erros

### Fallback

Se o worker não estiver configurado (`WORKER_UPLOAD_URL` vazio), o sistema automaticamente usa presigned URLs diretas como fallback. Isso permite desenvolvimento sem worker, mas pode ter problemas de CORS em produção.

## Benefícios

- ✅ **Sem base64 no banco**: Apenas URLs são armazenadas
- ✅ **Upload via Worker**: Resolve problemas de CORS usando edge service
- ✅ **Serviço de Imagens**: Worker serve imagens publicamente, resolvendo acesso ao R2 privado
- ✅ **Acesso Público**: Imagens acessíveis via worker mesmo com bucket R2 privado
- ✅ **Fallback automático**: Funciona com ou sem worker configurado
- ✅ **Organização**: Imagens separadas por usuário e tipo (`users/{uuid}/posts/`)
- ✅ **Compatibilidade**: Telegram e WhatsApp aceitam URLs HTTP/HTTPS
- ✅ **Performance**: Upload e serviço via edge, sem processamento no backend
- ✅ **Cache**: Headers de cache configurados para melhor performance
- ✅ **Validação**: Backend rejeita base64, garantindo apenas URLs válidas
- ✅ **Segurança**: Validação de token JWT no worker antes de upload
