import { Injectable } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CopyMessagesService } from '../copy-messages/copy-messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { ShopeeCacheService } from '../shopee/shopee-cache.service';
import { DealsService } from './deals.service';
import { MarkupType } from './formatters/message.formatter';
import { PostsService } from './posts.service';
import { PublisherService } from './publisher.service';

@Injectable()
export class SchedulerService {

  constructor(
    private prisma: PrismaService,
    private dealsService: DealsService,
    private postsService: PostsService,
    private publisherService: PublisherService,
    private copyMessagesService: CopyMessagesService,
    private schedulerRegistry: SchedulerRegistry,
    private shopeeCacheService: ShopeeCacheService,
    private productsService: ProductsService,
  ) {}

  /**
   * Executa todos os schedulers ativos
   * Roda a cada minuto para verificar se algum scheduler precisa ser executado
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async executeSchedulers() {
    const now = new Date();

    // Buscar schedulers ativos que precisam ser executados
    const schedulers = await this.prisma.postScheduler.findMany({
      where: {
        isActive: true,
        OR: [
          { nextRunAt: null }, // Nunca foi executado
          { nextRunAt: { lte: now } }, // Próxima execução já passou
        ],
      },
      include: {
        integration: true,
        channels: {
          include: {
            channel: true,
          },
        },
      },
    });

    for (const scheduler of schedulers) {
      try {
        await this.executeScheduler(scheduler.id);
      } catch (error) {
        // Error executing scheduler
      }
    }
  }

  /**
   * Executa um scheduler específico
   */
  async executeScheduler(schedulerId: string) {
    const scheduler = await this.prisma.postScheduler.findUnique({
      where: { id: schedulerId },
      include: {
        integration: true,
        channels: {
          include: {
            channel: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });

    if (!scheduler || !scheduler.isActive) {
      throw new Error(`Scheduler ${schedulerId} not found or inactive`);
    }

    if (!scheduler.integration.isActive) {
      return;
    }

    // Filtrar apenas canais ativos
    const activeChannels = scheduler.channels.filter(
      (sc) => sc.channel.isActive,
    );

    if (activeChannels.length === 0) {
      // Atualizar próxima execução mesmo assim
      await this.updateNextRun(scheduler);
      return;
    }

    // Buscar produtos usando a configuração do scheduler
    const config = scheduler.config as any;
    const productIds = config.productIds || [];
    const keywords = config.keywords || []; // Manter para compatibilidade
    const targetLimit = config.limit || 1;

    // Se productIds está definido, buscar Products e usar seus nomes como keywords
    let searchKeywords: string[] = [];
    const productMap = new Map<string, any>(); // Mapear keyword -> Product

    if (productIds && productIds.length > 0) {
      // Buscar Products pelos IDs
      const allProducts = await this.productsService.findByIds(productIds);

      // Filtrar apenas produtos dos canais do scheduler
      const schedulerChannelIds = activeChannels.map((sc) => sc.channelId);
      const products = allProducts.filter((p) =>
        schedulerChannelIds.includes(p.channelId),
      );

      if (products.length === 0) {
        await this.updateNextRun(scheduler);
        return;
      }

      // Usar nomes dos Products como keywords
      searchKeywords = products.map((p) => p.name);

      // Criar mapa keyword -> Product para match posterior
      products.forEach((product) => {
        productMap.set(product.name.toLowerCase(), product);
      });

    } else {
      // Fallback para keywords antigas (compatibilidade)
      searchKeywords = Array.isArray(keywords) ? keywords : [];
    }

    // Obter categoria do canal para garantir consistência
    const channelCategory = activeChannels[0]?.channel?.category;
    const expectedCategory = config.category || channelCategory?.slug || 'tech';
    const expectedSubcategory = config.subcategory;
    const minRatingStar = config.minRatingStar ?? 4.5; // Valor padrão 4.5
    const blockedKeywords = config.blockedKeywords || []; // Palavras bloqueadas

    // Buscar produtos até encontrar quantidade suficiente que atenda aos critérios
    // Buscar mais produtos do que o limit para ter margem após filtragem
    const searchLimit = Math.max(targetLimit * 3, 20); // Buscar 3x o limit ou mínimo 20

    const validProducts: any[] = [];
    const processedItemIds = new Set<string>(); // Rastrear itemIds já processados nesta execução

    // Iterar por cada keyword/produto individualmente
    for (const keyword of searchKeywords) {
      // Se já temos produtos suficientes, parar
      if (validProducts.length >= targetLimit) {
        break;
      }

      // Buscar produtos usando uma única keyword
      const products = await this.dealsService.fetchDealsByIntegration(
        scheduler.integrationId,
        activeChannels[0]?.channelId,
        {
          keywords: [keyword], // Buscar apenas esta keyword
          category: expectedCategory as any,
          subcategory: expectedSubcategory,
          limit: searchLimit,
          minCommission: config.minCommission,
          minScore: config.minScore,
        },
      );

      if (products.length === 0) {
        continue; // Continuar para a próxima keyword
      }

      // Filtrar produtos que atendem aos critérios e são da categoria correta
      // E validar se devem ser enviados (comparar preços via cache)
      const filtered: any[] = [];

      for (const product of products) {
        // Adicionar a keyword usada ao produto para rastreamento
        (product as any)._usedKeyword = keyword;

        // Verificar palavras bloqueadas (normalizado)
        if (blockedKeywords.length > 0) {
          const productNameNormalized = product.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''); // Remove acentos

          const hasBlockedKeyword = blockedKeywords.some((blocked) => {
            const blockedNormalized = blocked
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
            return productNameNormalized.includes(blockedNormalized);
          });

          if (hasBlockedKeyword) {
            continue;
          }
        }

        // Verificar ratingStar mínimo (configurável)
        if (
          product.ratingStar !== undefined &&
          product.ratingStar < minRatingStar
        ) {
          continue;
        }

        // Verificar categoria
        if (product.category !== expectedCategory) {
          continue;
        }

        // Verificar subcategoria se especificada
        if (
          expectedSubcategory &&
          product.subcategory !== expectedSubcategory
        ) {
          continue;
        }

        // Verificar se já está na lista de produtos válidos (evitar duplicatas por link)
        if (validProducts.some((p) => p.link === product.link)) {
          continue;
        }

        // Verificar se já foi processado nesta execução (evitar duplicatas por itemId)
        if (product.itemId && processedItemIds.has(product.itemId)) {
          continue;
        }

        // Validar se deve enviar usando itemId e comparação de preços
        if (product.itemId && product.marketplace === 'shopee') {
          const shouldSend =
            await this.shopeeCacheService.shouldSendSchedulerProduct(
              product.itemId,
              product.price,
              product.originalPrice,
            );

          if (!shouldSend) {
            continue;
          }

          // NÃO cachear aqui - será cacheado após publicar com o copyId
          processedItemIds.add(product.itemId); // Marcar como processado
        }

        filtered.push(product);
      }

      if (filtered.length > 0) {
        validProducts.push(...filtered);
      }
    }

    // Limitar aos produtos necessários
    const productsToPublish = validProducts.slice(0, targetLimit);

    if (productsToPublish.length === 0) {
      await this.updateNextRun(scheduler);
      return;
    }

    // Processar cada produto encontrado
    for (const product of productsToPublish) {
      try {
        await this.processAndPublishProduct(
          product,
          scheduler,
          activeChannels,
          productMap,
          product._usedKeyword, // Keyword usada para encontrar este produto
        );
      } catch (error) {
        // Error processing product
      }
    }

    // Atualizar última execução e próxima execução
    await this.updateNextRun(scheduler);
  }

  /**
   * Processa um produto e publica nos canais configurados
   */
  private async processAndPublishProduct(
    product: any,
    scheduler: any,
    channels: any[],
    productMap?: Map<string, any>,
    usedKeyword?: string,
  ) {
    // Verificar se o produto corresponde a um Product cadastrado
    // Como o produto foi encontrado usando uma keyword cadastrada, sempre tentar buscar copy
    let matchedProduct: any = null;
    let productCopy: string | undefined = undefined;
    let productCopyId: string | undefined = undefined;
    let productChannel: any = null;
    let productCategoryId: string | undefined = undefined;

    // Buscar copyIds já usadas para este produto (se tiver itemId)
    let usedCopyIds: string[] = [];
    if (product.itemId) {
      usedCopyIds = await this.shopeeCacheService.getUsedCopyIds(
        product.itemId,
      );
    }

    // Se temos productMap e keyword usada, fazer match direto pela keyword
    if (productMap && productMap.size > 0 && usedKeyword) {
      const keywordLower = usedKeyword.toLowerCase();
      const dbProduct = productMap.get(keywordLower);

      if (dbProduct) {
        matchedProduct = dbProduct;
        productChannel = dbProduct.channel;
        productCategoryId =
          dbProduct.categoryId || productChannel?.category?.id;

        // Atribuir categoria do canal ao produto se ainda não tiver
        if (
          productChannel &&
          productChannel.category &&
          !dbProduct.categoryId
        ) {
          await this.productsService.update(dbProduct.id, {
            categoryId: productChannel.category.id,
          });
          productCategoryId = productChannel.category.id;
        }
      }
    }

    // Se encontrou produto cadastrado, buscar copy relacionada
    if (matchedProduct) {
      const copyResult = await this.copyMessagesService.getRandomCopyForProduct(
        matchedProduct.id,
        usedCopyIds,
        productCategoryId,
      );

      if (copyResult) {
        productCopy = copyResult.message;
        productCopyId = copyResult.copyId;
      }
    } else if (productMap && productMap.size > 0) {
      // Produto foi encontrado usando keyword cadastrada, mas não fez match exato
      // Usar a categoria do canal para buscar copy genérica da categoria
      const firstChannel = channels[0]?.channel;
      productCategoryId = firstChannel?.category?.id;

      if (productCategoryId) {
        // Buscar copy da categoria sem subcategoria
        const categoryCopies =
          await this.copyMessagesService.findAll(productCategoryId);

        // Filtrar copies sem subcategoria e já usadas
        const availableCopies = categoryCopies.filter(
          (copy) => !copy.subcategoryId && !usedCopyIds.includes(copy.id),
        );

        if (availableCopies.length > 0) {
          const selectedCopy =
            availableCopies[Math.floor(Math.random() * availableCopies.length)];
          productCopy = selectedCopy.message;
          productCopyId = selectedCopy.id;
        }
      }
    }

    // Formatar preço
    const formatPrice = (value: number) =>
      value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });

    // Construir mensagem final
    // IMPORTANTE: O scheduler usa APENAS copies relacionadas ao produto cadastrado
    // Não usa strategies de copy automáticas
    let finalMessage = '';

    // Se produto tem copy relacionada, incluir a copy
    if (productCopy) {
      finalMessage += `${productCopy}\n\n`;
    }

    // Nome do produto
    finalMessage += `🛒 ${product.name}\n\n`;

    // Preço
    if (product.originalPrice && product.originalPrice > product.price) {
      finalMessage += `💸 De <s>${formatPrice(product.originalPrice)}</s>\n`;
      finalMessage += `➡️ Por ${formatPrice(product.price)}\n\n`;
    } else {
      finalMessage += `💸 ${formatPrice(product.price)}\n\n`;
    }

    // Call to action e link
    finalMessage += `👉 Comprar agora 👇\n`;
    finalMessage += `${product.link}`;

    // O título será a mensagem final completa
    const title = finalMessage;
    // A mensagem será vazia (já que o título contém tudo)
    const message = '';

    // Publicar em cada canal (SEM criar post no banco de dados)

    // Cachear produto apenas uma vez (após primeira publicação bem-sucedida)
    // O cache é compartilhado entre canais, então só precisa ser feito uma vez
    let productCached = false;

    for (const schedulerChannel of channels) {
      const channel = schedulerChannel.channel;

      try {
        // Determinar formato baseado no tipo de canal
        let markupType: MarkupType = MarkupType.HTML;
        if (channel.type !== 'telegram') {
          markupType = MarkupType.PLAIN;
        }

        // Buscar token do Telegram do config do canal
        const channelConfig = channel.config as any;
        const telegramBotToken =
          channel.type === 'telegram'
            ? channelConfig?.telegramBotToken
            : undefined;

        // A imagem deve aparecer primeiro, então passamos a imageUrl do produto
        // O título será a copy (mensagem completa)
        // A mensagem será vazia já que tudo está no título
        const result = await this.publisherService.publishToChannel(
          channel.type,
          channel.chatId,
          title, // Copy completa como título
          message, // Mensagem vazia
          product.imageUrl, // Imagem do produto (aparece primeiro)
          markupType,
          telegramBotToken,
        );

        if (result.success) {
          // Cachear produto após primeira publicação bem-sucedida (compartilhado entre canais)
          if (product.itemId && !productCached) {
            await this.shopeeCacheService.cacheSchedulerProduct(
              product.itemId,
              product.price,
              product.originalPrice,
              productCopyId, // Incluir copyId no cache
            );
            productCached = true;
          }
        } else {
          throw new Error(result.error || 'Failed to publish');
        }
      } catch (error) {
        // Continuar para o próximo canal mesmo se houver erro
        // Não criar registro de falha no banco (scheduler não usa banco)
      }
    }
  }

  /**
   * Atualiza a próxima execução do scheduler
   */
  private async updateNextRun(scheduler: any) {
    const now = new Date();
    const nextRun = new Date(
      now.getTime() + scheduler.intervalMinutes * 60 * 1000,
    );

    await this.prisma.postScheduler.update({
      where: { id: scheduler.id },
      data: {
        lastRunAt: now,
        nextRunAt: nextRun,
      },
    });
  }
}
