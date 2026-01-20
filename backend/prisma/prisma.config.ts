import 'dotenv/config';
import path from 'path';
import { defineConfig } from 'prisma/config';

export const dbConfig = defineConfig({
  schema: path.join(__dirname, 'schema.prisma'),
  migrations: {
    path: path.join(__dirname, 'migrations'),
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});

export default dbConfig;
