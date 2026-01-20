FROM node:22-bullseye

WORKDIR /app

# Instalar pnpm
RUN npm install -g pnpm

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml* ./
RUN pnpm i

COPY . .

RUN chmod +x docker-entrypoint.sh

EXPOSE 3001

CMD ["sh", "./docker-entrypoint.sh"]
