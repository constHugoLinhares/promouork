import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/**
 * Interface para armazenar informações de cache de produtos
 */
interface CachedProduct {
  link: string;
  price: number;
  originalPrice?: number;
  sentAt: Date;
  usedCopyIds?: string[]; // IDs das copies já usadas para este produto
}

/**
 * TTL do cache em segundos (7 dias)
 */
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 604800 segundos

/**
 * Serviço de cache para rastrear produtos já enviados da Shopee
 * Evita repetir itens já enviados, a menos que entrem em promoção melhor
 * Usa Redis para cache rápido com TTL de 7 dias, com fallback para Prisma
 */
@Injectable()
export class ShopeeCacheService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  /**
   * Gera a chave do cache no Redis baseada no ID do produto
   */
  private getCacheKey(productId: string): string {
    return `shopee:product:${productId}`;
  }

  /**
   * Gera a chave do cache no Redis baseada no itemId do produto
   * Usado para scheduler (validação por itemId)
   */
  private getSchedulerCacheKey(itemId: string): string {
    return `shopee:scheduler:${itemId}`;
  }

  /**
   * Verifica se um produto já foi enviado anteriormente
   * Primeiro verifica no Redis, depois no banco de dados
   * @param link - Link do produto
   * @returns Informações do produto enviado ou null se nunca foi enviado
   */
  async getCachedProduct(link: string): Promise<CachedProduct | null> {
    // Normalizar o link para comparação (extrair ID do produto)
    const productId = this.extractProductId(link);

    if (!productId) {
      console.log(
        `[Cache] Could not extract product ID from link: ${link.substring(0, 100)}`,
      );
      // Se não conseguir extrair o ID, tentar normalizar o link
      const normalizedLink = this.normalizeLink(link);
      return this.findProductByLink(normalizedLink);
    }

    console.log(
      `[Cache] Extracted product ID: ${productId} from link: ${link.substring(0, 100)}`,
    );

    // Tentar buscar no Redis primeiro
    const cacheKey = this.getCacheKey(productId);
    const cached = await this.redisService.get<CachedProduct>(cacheKey);

    if (cached) {
      console.log(
        `[Cache] Found in Redis: Product ID ${productId} - Price: R$ ${cached.price}`,
      );
      return cached;
    }

    // Se não encontrou no Redis, buscar no banco de dados
    // Buscar TODOS os produtos enviados (sem filtro de data)
    // Produtos em cache NUNCA devem ser reenviados, independentemente de quando foram enviados
    console.log(
      `[Cache] Not found in Redis, querying database for product ID: ${productId}`,
    );

    const postProduct = await this.prisma.postProduct.findFirst({
      where: {
        AND: [
          {
            OR: [
              {
                link: {
                  contains: productId,
                },
              },
              // Também tentar buscar pelo itemId se estiver no formato correto
              {
                link: {
                  contains: `item_id=${productId}`,
                },
              },
              {
                link: {
                  contains: `/i.${productId}`,
                },
              },
              {
                link: {
                  contains: `-i.${productId}`,
                },
              },
            ],
          },
          {
            marketplace: 'shopee',
          },
        ],
      },
      include: {
        post: {
          select: {
            createdAt: true,
          },
        },
      },
      orderBy: {
        post: {
          createdAt: 'desc',
        },
      },
    });

    if (!postProduct) {
      console.log(`[Cache] Product with ID ${productId} not found in database`);
      return null;
    }

    console.log(
      `[Cache] Found in database: ${postProduct.name.substring(0, 50)} - Price: R$ ${postProduct.price} - Link: ${postProduct.link.substring(0, 100)}`,
    );

    const cachedProduct: CachedProduct = {
      link: postProduct.link,
      price: postProduct.price,
      originalPrice: postProduct.originalPrice || undefined,
      sentAt: postProduct.post.createdAt,
    };

    // Armazenar no Redis com TTL de 7 dias
    await this.redisService.set(cacheKey, cachedProduct, CACHE_TTL_SECONDS);
    console.log(
      `[Cache] Cached product ID ${productId} in Redis with TTL of 7 days`,
    );

    return cachedProduct;
  }

  /**
   * Busca produto por link normalizado (fallback)
   * Busca TODOS os produtos enviados (sem filtro de data)
   */
  private async findProductByLink(
    normalizedLink: string,
  ): Promise<CachedProduct | null> {
    const postProduct = await this.prisma.postProduct.findFirst({
      where: {
        link: {
          contains: normalizedLink,
        },
        marketplace: 'shopee',
      },
      include: {
        post: {
          select: {
            createdAt: true,
          },
        },
      },
      orderBy: {
        post: {
          createdAt: 'desc',
        },
      },
    });

    if (!postProduct) {
      return null;
    }

    return {
      link: postProduct.link,
      price: postProduct.price,
      originalPrice: postProduct.originalPrice || undefined,
      sentAt: postProduct.post.createdAt,
    };
  }

  /**
   * Extrai o ID do produto da URL da Shopee
   * URLs da Shopee podem ter vários formatos:
   * - .../i.{shopId}.{itemId} (ex: /i.123456.7890123)
   * - .../item/{itemId} (ex: /item/7890123)
   * - item_id nos query params
   * - itemId no path (ex: /product-name-i.{shopId}.{itemId})
   */
  private extractProductId(link: string): string | null {
    try {
      const url = new URL(link);
      const pathname = url.pathname;
      const fullUrl = link.toLowerCase();

      // Padrão 1: item_id nos query params (mais confiável)
      const itemIdParam = url.searchParams.get('item_id');
      if (itemIdParam) {
        return itemIdParam;
      }

      // Padrão 2: /i.{shopId}.{itemId} (ex: /i.123456.7890123)
      // Pode aparecer no pathname ou no final da URL
      const pattern1 = /[\/\.]i\.(\d+)\.(\d+)/;
      const match1 = fullUrl.match(pattern1);
      if (match1) {
        return match1[2]; // Retornar itemId (segundo número)
      }

      // Padrão 3: /item/{itemId} (ex: /item/7890123)
      const pattern2 = /\/item\/(\d+)/;
      const match2 = pathname.match(pattern2);
      if (match2) {
        return match2[1];
      }

      // Padrão 4: itemId no final do pathname (ex: /product-name-i.123456.7890123)
      // Buscar por padrão -i.{shopId}.{itemId} no final
      const pattern3 = /-i\.(\d+)\.(\d+)(?:\?|$|\/)/;
      const match3 = fullUrl.match(pattern3);
      if (match3) {
        return match3[2]; // Retornar itemId
      }

      // Padrão 5: itemId isolado no pathname (último número grande no path)
      // Buscar por números grandes (mais de 6 dígitos) no pathname
      const numbers = pathname.match(/\d{7,}/g);
      if (numbers && numbers.length > 0) {
        // Retornar o último número grande (geralmente é o itemId)
        return numbers[numbers.length - 1];
      }

      return null;
    } catch {
      // Se não for uma URL válida, tentar extrair números diretamente
      const numbers = link.match(/\d{7,}/g);
      if (numbers && numbers.length > 0) {
        return numbers[numbers.length - 1];
      }
      return null;
    }
  }

  /**
   * Verifica se um produto foi enviado nos últimos 7 dias
   * @param sentAt - Data de envio do produto
   * @returns true se foi enviado nos últimos 7 dias
   */
  private isWithinTTL(sentAt: Date): boolean {
    const now = new Date();
    const sentDate = new Date(sentAt);
    const diffInMs = now.getTime() - sentDate.getTime();
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
    return diffInDays < 7;
  }

  /**
   * Verifica se um produto deve ser enviado
   * Retorna true APENAS se o produto NUNCA foi enviado (não está no cache)
   *
   * IMPORTANTE: Produtos em cache NUNCA são reenviados, independentemente
   * de quando foram enviados ou mudanças de preço.
   *
   * @param link - Link do produto
   * @param currentPrice - Preço atual do produto (não usado, mantido para compatibilidade)
   * @param currentOriginalPrice - Preço original atual (não usado, mantido para compatibilidade)
   * @returns true se deve enviar (não está no cache), false caso contrário (está no cache)
   */
  async shouldSendProduct(
    link: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    currentPrice: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    currentOriginalPrice?: number,
  ): Promise<boolean> {
    const productId = this.extractProductId(link);
    const cached = await this.getCachedProduct(link);

    // Se nunca foi enviado (não está no cache), deve enviar
    if (!cached) {
      console.log(
        `[Cache] Product ${productId || link.substring(0, 50)} not found in cache - will send`,
      );
      return true;
    }

    // Se está no cache, NUNCA enviar (independentemente de quando foi enviado)
    const daysSinceSent = Math.round(
      (new Date().getTime() - new Date(cached.sentAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    console.log(
      `[Cache] Product ${productId || link.substring(0, 50)} is in cache (sent ${daysSinceSent} days ago) - BLOCKED (never resend cached products)`,
    );
    return false;
  }

  /**
   * Filtra produtos que devem ser enviados
   * Remove TODOS os produtos que estão no cache (já foram enviados)
   * Apenas produtos que NUNCA foram enviados são retornados
   * @param products - Array de produtos a filtrar
   * @returns Array de produtos que devem ser enviados (não estão no cache)
   */
  async filterNewOrBetterProducts(
    products: Array<{
      link: string;
      price: number;
      originalPrice?: number;
    }>,
  ): Promise<Array<{ link: string; price: number; originalPrice?: number }>> {
    const filteredProducts: Array<{
      link: string;
      price: number;
      originalPrice?: number;
    }> = [];

    for (const product of products) {
      const shouldSend = await this.shouldSendProduct(
        product.link,
        product.price,
        product.originalPrice,
      );

      // Apenas adicionar se NÃO está no cache (nunca foi enviado)
      if (shouldSend) {
        filteredProducts.push(product);
      }
    }

    return filteredProducts;
  }

  /**
   * Normaliza um link para comparação
   * Remove query params desnecessários e normaliza a URL
   * Usado como fallback quando não consegue extrair o ID do produto
   */
  private normalizeLink(link: string): string {
    try {
      const url = new URL(link);
      // Manter apenas o pathname e alguns query params importantes
      // Remover affiliate_id, tracking params, etc.
      const importantParams = ['item_id', 'shop_id'];
      const newParams = new URLSearchParams();

      for (const param of importantParams) {
        if (url.searchParams.has(param)) {
          newParams.set(param, url.searchParams.get(param)!);
        }
      }

      // Se não há params importantes, usar apenas o pathname
      if (newParams.toString() === '') {
        return url.pathname;
      }

      url.search = newParams.toString();
      return url.toString();
    } catch {
      // Se não for uma URL válida, retornar como está
      return link;
    }
  }

  /**
   * Cacheia um produto no Redis quando ele é criado
   * @param link - Link do produto
   * @param price - Preço do produto
   * @param originalPrice - Preço original (opcional)
   * @param sentAt - Data de envio
   */
  async cacheProduct(
    link: string,
    price: number,
    originalPrice?: number,
    sentAt?: Date,
  ): Promise<void> {
    const productId = this.extractProductId(link);
    if (!productId) {
      return;
    }

    const cacheKey = this.getCacheKey(productId);
    const cachedProduct: CachedProduct = {
      link,
      price,
      originalPrice,
      sentAt: sentAt || new Date(),
    };

    await this.redisService.set(cacheKey, cachedProduct, CACHE_TTL_SECONDS);
    console.log(
      `[Cache] Cached new product ID ${productId} in Redis with TTL of 7 days`,
    );
  }

  /**
   * Valida se um produto do scheduler deve ser enviado
   * Compara o preço atual com o preço em cache
   * Se o preço mudou, permite enviar e atualiza o cache
   * IMPORTANTE: Se o produto não está no cache, retorna true mas NÃO cacheia aqui
   * O cache deve ser feito imediatamente após a validação passar (no scheduler)
   * @param itemId - ID do item na Shopee
   * @param currentPrice - Preço atual do produto
   * @param currentOriginalPrice - Preço original atual (opcional)
   * @returns true se deve enviar (não está no cache OU preço mudou), false caso contrário
   */
  async shouldSendSchedulerProduct(
    itemId: string,
    currentPrice: number,
    currentOriginalPrice?: number,
  ): Promise<boolean> {
    if (!itemId) {
      console.log('[Cache] No itemId provided for scheduler product');
      return true; // Se não tem itemId, permitir enviar
    }

    const cacheKey = this.getSchedulerCacheKey(itemId);
    const cached = await this.redisService.get<CachedProduct>(cacheKey);

    // Se não está no cache, deve enviar (mas não cacheia aqui - será cacheado após validação)
    if (!cached) {
      console.log(
        `[Cache] Scheduler product itemId ${itemId} not found in cache - will send (will be cached after validation)`,
      );
      return true;
    }

    // Comparar preços (com tolerância para diferenças de arredondamento)
    const priceDifference = Math.abs(cached.price - currentPrice);
    const priceChanged = priceDifference > 0.01; // Tolerância de 1 centavo

    if (priceChanged) {
      console.log(
        `[Cache] Scheduler product itemId ${itemId} price changed: R$ ${cached.price} -> R$ ${currentPrice} - will send`,
      );
      // Atualizar cache com novo preço imediatamente
      await this.cacheSchedulerProduct(
        itemId,
        currentPrice,
        currentOriginalPrice,
      );
      return true;
    }

    console.log(
      `[Cache] Scheduler product itemId ${itemId} price unchanged (R$ ${currentPrice}) - BLOCKED`,
    );
    return false;
  }

  /**
   * Cacheia um produto do scheduler no Redis
   * @param itemId - ID do item na Shopee
   * @param price - Preço do produto
   * @param originalPrice - Preço original (opcional)
   * @param copyId - ID da copy usada (opcional)
   */
  async cacheSchedulerProduct(
    itemId: string,
    price: number,
    originalPrice?: number,
    copyId?: string,
  ): Promise<void> {
    if (!itemId) {
      return;
    }

    const cacheKey = this.getSchedulerCacheKey(itemId);

    // Buscar cache existente para preservar copyIds já usadas
    const existingCache = await this.redisService.get<CachedProduct>(cacheKey);
    const usedCopyIds = existingCache?.usedCopyIds || [];

    // Se uma copyId foi fornecida e ainda não está na lista, adicionar
    if (copyId && !usedCopyIds.includes(copyId)) {
      usedCopyIds.push(copyId);
    }

    const cachedProduct: CachedProduct = {
      link: '', // Não necessário para scheduler
      price,
      originalPrice,
      sentAt: new Date(),
      usedCopyIds,
    };

    await this.redisService.set(cacheKey, cachedProduct, CACHE_TTL_SECONDS);
    console.log(
      `[Cache] Cached scheduler product itemId ${itemId} in Redis with TTL of 7 days${copyId ? `, copyId: ${copyId}` : ''}`,
    );
  }

  /**
   * Retorna as copyIds já usadas para um produto do scheduler
   * @param itemId - ID do item na Shopee
   * @returns Array de copyIds já usadas
   */
  async getUsedCopyIds(itemId: string): Promise<string[]> {
    if (!itemId) {
      return [];
    }

    const cacheKey = this.getSchedulerCacheKey(itemId);
    const cached = await this.redisService.get<CachedProduct>(cacheKey);

    return cached?.usedCopyIds || [];
  }

  /**
   * Limpa todo o cache de produtos da Shopee (produtos e scheduler)
   * @returns Número de chaves deletadas
   */
  async clearAllCache(): Promise<number> {
    try {
      // Deletar todas as chaves relacionadas a produtos Shopee
      const productKeys =
        await this.redisService.deleteByPattern('shopee:product:*');
      const schedulerKeys =
        await this.redisService.deleteByPattern('shopee:scheduler:*');

      const totalDeleted = productKeys + schedulerKeys;
      console.log(
        `[Cache] Cleared all Shopee cache: ${productKeys} product keys + ${schedulerKeys} scheduler keys = ${totalDeleted} total`,
      );

      return totalDeleted;
    } catch (error) {
      console.error('[Cache] Error clearing all cache:', error);
      throw error;
    }
  }

  /**
   * Limpa o cache de produtos antigos (opcional, para manutenção)
   * Remove do banco de dados e do Redis
   * @param daysOld - Número de dias para considerar como "antigo"
   */
  async clearOldCache(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Buscar produtos antigos antes de deletar para limpar o Redis
    const oldProducts = await this.prisma.postProduct.findMany({
      where: {
        marketplace: 'shopee',
        post: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      },
      select: {
        link: true,
      },
    });

    // Limpar do Redis
    for (const product of oldProducts) {
      const productId = this.extractProductId(product.link);
      if (productId) {
        const cacheKey = this.getCacheKey(productId);
        await this.redisService.del(cacheKey);
      }
    }

    // Deletar do banco de dados
    const result = await this.prisma.postProduct.deleteMany({
      where: {
        marketplace: 'shopee',
        post: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      },
    });

    return result.count;
  }
}
