import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST') || 'redis';
    const port = this.configService.get<number>('REDIS_PORT') || 6379;
    const password = this.configService.get<string>('REDIS_PASSWORD');

    this.client = new Redis({
      host,
      port,
      password,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.client.on('error', (err) => {
      console.error('[Redis] Connection error:', err);
    });

    this.client.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    // Test connection
    try {
      await this.client.ping();
      console.log('[Redis] Connection test successful');
    } catch (error) {
      console.error('[Redis] Connection test failed:', error);
    }
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`[Redis] Error getting key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error(`[Redis] Error setting key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`[Redis] Error deleting key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`[Redis] Error checking existence of key ${key}:`, error);
      return false;
    }
  }

  /**
   * Deleta todas as chaves que correspondem a um padrão
   * @param pattern - Padrão de busca (ex: "shopee:*")
   * @returns Número de chaves deletadas
   */
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      let deletedCount = 0;
      let cursor = '0';

      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );

        cursor = nextCursor;

        if (keys.length > 0) {
          const deleted = await this.client.del(...keys);
          deletedCount += deleted;
        }
      } while (cursor !== '0');

      console.log(
        `[Redis] Deleted ${deletedCount} keys matching pattern: ${pattern}`,
      );
      return deletedCount;
    } catch (error) {
      console.error(
        `[Redis] Error deleting keys by pattern ${pattern}:`,
        error,
      );
      throw error;
    }
  }
}
