import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import * as path from 'path';

// Resolve o caminho do Prisma Client gerado em runtime
// Funciona tanto em dev (ts-node) quanto em prod (compilado)
const prismaGeneratedPath = path.resolve(
  __dirname,
  '../../../prisma/generated',
);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require(prismaGeneratedPath);

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionUrl = process.env.DATABASE_URL;

    if (!connectionUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const adapter = new PrismaPg({
      connectionString: connectionUrl,
    });

    super({
      adapter,
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
