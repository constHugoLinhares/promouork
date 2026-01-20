#!/bin/sh

cd /app

echo "Executando migrações do Prismas..."
pnpm prisma:deploy

echo "Executando seed do Prisma..."
pnpm prisma:seed

echo "Iniciando servidor de desenvolvimento..."
exec pnpm start:dev

