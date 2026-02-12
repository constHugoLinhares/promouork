# Evolution API – Documentação do fluxo desejado

Este documento descreve o fluxo desejado da integração com a Evolution API no Promouork: geração e exibição do QR code, conexão via WhatsApp, botão de sair e aviso sobre risco de banimento.

---

## Visão geral

- **Evolution API** roda via Docker (`docker-compose.evolution.yml`, porta 8081).
- Uma **única instância** Evolution por aplicação (um número WhatsApp); credenciais (`instanceName`, `apikey`) ficam na integração do tipo `evolution` no banco.
- O usuário **conecta** pela página de Integrações: vê o QR, escaneia no WhatsApp e pode **sair** (logout) quando quiser.
- Um **aviso claro** deve informar que nenhum número está imune a banimento e que é importante evitar spam.

---

## Fluxo desejado

### 1. Conectar (gerar e exibir QR)

1. Usuário acessa **Integrações** e clica em **Conectar** na card da Evolution (WhatsApp).
2. Frontend chama o backend (ex.: `POST /evolution/connect`).
3. Backend, se ainda não houver instância:
   - Cria a instância na Evolution API.
   - Salva `instanceName` e `apikey` em `Integration.credentials` (integração `evolution`).
4. Backend obtém o QR da Evolution (endpoint Instance Connect) e devolve o QR em base64 (ou formato definido pela API).
5. Frontend exibe:
   - **Aviso:** “Nenhum número está imune a banimento do WhatsApp. É importante evitar sempre o spam.”
   - **QR code** (imagem gerada a partir do base64).
   - Instrução: “Abra o WhatsApp no celular e escaneie o QR code para conectar.”

### 2. Polling do estado de conexão

1. Enquanto o usuário não escaneou o QR, o frontend faz polling (ex.: a cada 3–5 s) em um endpoint de status (ex.: `GET /evolution/status` ou `GET /evolution/connection-state`).
2. Backend consulta o estado da conexão na Evolution API e retorna (ex.: `open`, `close`, `connecting`).
3. Quando o estado for **conectado** (`open`):
   - Frontend para o polling.
   - Esconde o QR e mostra status **Conectado** e o **botão Sair**.

### 3. Usuário escaneia o QR

1. Usuário abre o WhatsApp no celular e escaneia o QR exibido na tela.
2. A Evolution API passa a reportar conexão aberta; o próximo polling já retorna “conectado”.
3. A UI atualiza para “Conectado” + botão **Sair**.

### 4. Sair (logout)

1. Usuário clica em **Sair**.
2. Frontend chama o backend (ex.: `DELETE /evolution/logout`).
3. Backend chama o endpoint de **logout** da Evolution API para a instância configurada.
4. Backend responde sucesso ao frontend.
5. Frontend atualiza a tela: volta a exibir o QR (ou o botão “Conectar”), mantendo o aviso de banimento visível.

### 5. Fechar o modal

- O usuário pode **fechar** o modal a qualquer momento (botão “Fechar”) sem deslogar; ao reabrir, a UI reflete o estado atual (conectado ou não, com QR se necessário).

---

## Diagrama de sequência (resumido)

```
Usuário          Frontend           Backend           Evolution API
   |                  |                  |                    |
   |  Clica Conectar  |                  |                    |
   |----------------->|  POST /connect    |                    |
   |                  |----------------->|  Create instance   |
   |                  |                  |------------------->|
   |                  |                  |  instanceName+key  |
   |                  |                  |<-------------------|
   |                  |                  |  GET connect (QR)  |
   |                  |                  |------------------->|
   |                  |  { qrCode }       |<-------------------|
   |                  |<-----------------|                    |
   |  Exibe QR + aviso|                  |                    |
   |<-----------------|                  |                    |
   |                  |  GET status (poll)|                    |
   |                  |----------------->|  GET connection    |
   |                  |                  |------------------->|
   |  Escaneia QR     |                  |  state = open       |
   |  (WhatsApp)      |                  |<-------------------|
   |                  |  state: open      |                    |
   |                  |<-----------------|                    |
   |  "Conectado" +   |                  |                    |
   |  Botão Sair      |                  |                    |
   |<-----------------|                  |                    |
   |  Clica Sair      |  DELETE /logout  |  DELETE logout     |
   |----------------->|----------------->|------------------->|
   |                  |       ok         |<-------------------|
   |                  |<-----------------|                    |
   |  Volta QR/Conectar                  |                    |
   |<-----------------|                  |                    |
```

---

## Aviso obrigatório (anti-spam)

Em todas as interações de conexão Evolution no frontend, exibir de forma **clara e visível** (não só em tooltip):

> **Nenhum número está imune a banimento do WhatsApp. É importante evitar sempre o spam.**

Sugestão: caixa de alerta (ex.: amarela/laranja) no topo do modal da Evolution e, se desejado, um resumo na card da integração na lista.

---

## Referências

- Evolution API no projeto: `docker-compose.evolution.yml`
- Documentação Evolution API v2: [doc.evolution-api.com/v2](https://doc.evolution-api.com/v2)
- Endpoints relevantes: Create Instance, Instance Connect (QR), Connection State, Logout Instance
