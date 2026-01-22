import { Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(SchedulerService.name);

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

    console.log(schedulers);

    for (const scheduler of schedulers) {
      try {
        await this.executeScheduler(scheduler.id);
      } catch (error) {
        this.logger.error(`Error executing scheduler ${scheduler.id}:`, error);
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
      this.logger.warn(
        `Scheduler ${schedulerId} skipped: integration ${scheduler.integrationId} is inactive`,
      );
      return;
    }

    // Filtrar apenas canais ativos
    const activeChannels = scheduler.channels.filter(
      (sc) => sc.channel.isActive,
    );

    if (activeChannels.length === 0) {
      this.logger.warn(`Scheduler ${schedulerId} skipped: no active channels`);
      // Atualizar próxima execução mesmo assim
      await this.updateNextRun(scheduler);
      return;
    }

    this.logger.log(`Executing scheduler ${scheduler.name} (${schedulerId})`);

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
        this.logger.warn(
          `No products found for scheduler channels. ProductIds: ${JSON.stringify(productIds)}, ChannelIds: ${JSON.stringify(schedulerChannelIds)}`,
        );
        await this.updateNextRun(scheduler);
        return;
      }

      // Usar nomes dos Products como keywords
      searchKeywords = products.map((p) => p.name);

      // Criar mapa keyword -> Product para match posterior
      products.forEach((product) => {
        productMap.set(product.name.toLowerCase(), product);
      });

      this.logger.log(
        `Scheduler config - productIds: ${JSON.stringify(productIds)}, products: ${JSON.stringify(searchKeywords)}, filtered by channels: ${JSON.stringify(schedulerChannelIds)}, limit: ${targetLimit}`,
      );
    } else {
      // Fallback para keywords antigas (compatibilidade)
      searchKeywords = Array.isArray(keywords) ? keywords : [];
      this.logger.log(
        `Scheduler config - keywords: ${JSON.stringify(searchKeywords)}, limit: ${targetLimit}`,
      );
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
        this.logger.log(
          `Reached target limit (${targetLimit}). Stopping search.`,
        );
        break;
      }

      this.logger.log(
        `Searching for products with keyword: "${keyword}" (${validProducts.length}/${targetLimit} found so far)`,
      );

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
        this.logger.warn(
          `No products found for keyword "${keyword}". Continuing to next keyword.`,
        );
        continue; // Continuar para a próxima keyword
      }

      this.logger.log(
        `Found ${products.length} products for keyword "${keyword}". Filtering...`,
      );

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
            this.logger.debug(
              `Product ${product.name} filtered: contains blocked keyword`,
            );
            continue;
          }
        }

        // Verificar ratingStar mínimo (configurável)
        if (
          product.ratingStar !== undefined &&
          product.ratingStar < minRatingStar
        ) {
          this.logger.debug(
            `Product ${product.name} filtered: ratingStar too low (${product.ratingStar} < ${minRatingStar})`,
          );
          continue;
        }

        // Verificar categoria
        if (product.category !== expectedCategory) {
          this.logger.debug(
            `Product ${product.name} filtered: category mismatch (${product.category} != ${expectedCategory})`,
          );
          continue;
        }

        // Verificar subcategoria se especificada
        if (
          expectedSubcategory &&
          product.subcategory !== expectedSubcategory
        ) {
          this.logger.debug(
            `Product ${product.name} filtered: subcategory mismatch (${product.subcategory} != ${expectedSubcategory})`,
          );
          continue;
        }

        // Verificar se já está na lista de produtos válidos (evitar duplicatas por link)
        if (validProducts.some((p) => p.link === product.link)) {
          continue;
        }

        // Verificar se já foi processado nesta execução (evitar duplicatas por itemId)
        if (product.itemId && processedItemIds.has(product.itemId)) {
          this.logger.debug(
            `Product ${product.name} (itemId: ${product.itemId}) already processed in this execution - skipping`,
          );
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
            this.logger.debug(
              `Product ${product.name} (itemId: ${product.itemId}) filtered: price unchanged in cache`,
            );
            continue;
          }

          // NÃO cachear aqui - será cacheado após publicar com o copyId
          processedItemIds.add(product.itemId); // Marcar como processado
          this.logger.debug(
            `Product ${product.name} (itemId: ${product.itemId}) validated - will be cached after publishing with copyId`,
          );
        }

        filtered.push(product);
      }

      if (filtered.length > 0) {
        this.logger.log(
          `Found ${filtered.length} valid products for keyword "${keyword}". Total valid products: ${validProducts.length + filtered.length}`,
        );
        validProducts.push(...filtered);
      } else {
        this.logger.warn(
          `No valid products found for keyword "${keyword}" after filtering. Continuing to next keyword.`,
        );
      }
    }

    // Limitar aos produtos necessários
    const productsToPublish = validProducts.slice(0, targetLimit);

    if (productsToPublish.length === 0) {
      this.logger.log(
        `No valid products found for scheduler ${schedulerId} (category: ${expectedCategory}, subcategory: ${expectedSubcategory})`,
      );
      await this.updateNextRun(scheduler);
      return;
    }

    this.logger.log(
      `Found ${productsToPublish.length}/${targetLimit} valid products for scheduler ${schedulerId}`,
    );

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
        this.logger.error(
          `Error processing product ${product.link} for scheduler ${schedulerId}:`,
          error,
        );
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
      this.logger.debug(
        `[Scheduler] Found ${usedCopyIds.length} already used copies for itemId ${product.itemId}`,
      );
    }

    // Se temos productMap e keyword usada, fazer match direto pela keyword
    if (productMap && productMap.size > 0 && usedKeyword) {
      const keywordLower = usedKeyword.toLowerCase();
      const dbProduct = productMap.get(keywordLower);

      this.logger.debug(
        `[Scheduler] Attempting match - keyword: "${usedKeyword}" (lowercase: "${keywordLower}"), productMap keys: ${Array.from(productMap.keys()).join(', ')}`,
      );

      if (dbProduct) {
        matchedProduct = dbProduct;
        productChannel = dbProduct.channel;
        productCategoryId =
          dbProduct.categoryId || productChannel?.category?.id;

        this.logger.log(
          `[Scheduler] ✅ Product match found: Shopee product "${product.name}" found via keyword "${usedKeyword}" -> DB Product "${dbProduct.name}" (ID: ${dbProduct.id})`,
        );

        // Atribuir categoria do canal ao produto se ainda não tiver
        if (
          productChannel &&
          productChannel.category &&
          !dbProduct.categoryId
        ) {
          await this.productsService.update(dbProduct.id, {
            categoryId: productChannel.category.id,
          });
          this.logger.log(
            `[Scheduler] Assigned category ${productChannel.category.slug} to product ${dbProduct.name} from channel ${productChannel.name}`,
          );
          productCategoryId = productChannel.category.id;
        }
      } else {
        this.logger.debug(
          `[Scheduler] No exact match found for keyword "${usedKeyword}" in productMap`,
        );
      }
    }

    // Se encontrou produto cadastrado, buscar copy relacionada
    if (matchedProduct) {
      this.logger.log(
        `[Scheduler] Searching for copy for product ID: ${matchedProduct.id} (name: ${matchedProduct.name}), category: ${productCategoryId}, excluding ${usedCopyIds.length} already used copies`,
      );
      const copyResult = await this.copyMessagesService.getRandomCopyForProduct(
        matchedProduct.id,
        usedCopyIds,
        productCategoryId,
      );

      if (copyResult) {
        productCopy = copyResult.message;
        productCopyId = copyResult.copyId;
        this.logger.log(
          `[Scheduler] ✅ Found Product match: ${matchedProduct.name} - using copy (ID: ${productCopyId}, length: ${productCopy.length} chars)`,
        );
        this.logger.debug(
          `[Scheduler] Copy content preview: ${productCopy.substring(0, 100)}...`,
        );
      } else {
        this.logger.warn(
          `[Scheduler] ⚠️ Found Product match: ${matchedProduct.name} - no available copies, will skip copy message`,
        );
      }
    } else if (productMap && productMap.size > 0) {
      // Produto foi encontrado usando keyword cadastrada, mas não fez match exato
      // Usar a categoria do canal para buscar copy genérica da categoria
      const firstChannel = channels[0]?.channel;
      productCategoryId = firstChannel?.category?.id;

      if (productCategoryId) {
        this.logger.log(
          `[Scheduler] Product found via keyword but no exact match. Searching for copy with category ${productCategoryId} (no subcategory) for Shopee product "${product.name}"`,
        );

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
          this.logger.log(
            `[Scheduler] ✅ Using category copy (ID: ${productCopyId}) for product found via keyword`,
          );
        } else {
          this.logger.warn(
            `[Scheduler] ⚠️ No category copies available (without subcategory) for category ${productCategoryId}`,
          );
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
      this.logger.log(
        `[Scheduler] ✅ Using Product-related copy: ${productCopy.substring(0, 50)}...`,
      );
      this.logger.debug(`[Scheduler] Full productCopy content: ${productCopy}`);
      finalMessage += `${productCopy}\n\n`;
    } else if (matchedProduct) {
      // Product existe mas não tem copy relacionada - não incluir copy
      this.logger.warn(
        `[Scheduler] ⚠️ Product exists but has no related copies - skipping copy message. Product: ${matchedProduct.name} (ID: ${matchedProduct.id})`,
      );
    } else {
      // Produto não está cadastrado - não incluir copy
      this.logger.warn(
        `[Scheduler] ⚠️ Product not registered - skipping copy message. Shopee product: "${product.name}"`,
      );
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

    this.logger.debug(
      `[Scheduler] Final message length: ${finalMessage.length} chars, includes copy: ${productCopy ? 'yes' : 'no'}`,
    );

    // O título será a mensagem final completa
    const title = finalMessage;
    // A mensagem será vazia (já que o título contém tudo)
    const message = '';

    // Publicar em cada canal (SEM criar post no banco de dados)
    this.logger.log(
      `[Scheduler] Publishing product "${product.name}" to ${channels.length} channel(s)`,
    );

    // Cachear produto apenas uma vez (após primeira publicação bem-sucedida)
    // O cache é compartilhado entre canais, então só precisa ser feito uma vez
    let productCached = false;

    for (const schedulerChannel of channels) {
      const channel = schedulerChannel.channel;

      this.logger.log(
        `[Scheduler] Publishing to channel: ${channel.name} (${channel.type})`,
      );

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
            this.logger.debug(
              `[Scheduler] Cached product itemId ${product.itemId} with copyId ${productCopyId}`,
            );
          }
          this.logger.log(
            `[Scheduler] ✅ Published product "${product.name}" (itemId: ${product.itemId}) to channel ${channel.name}${productCopyId ? ` with copy ${productCopyId}` : ''}`,
          );
        } else {
          throw new Error(result.error || 'Failed to publish');
        }
      } catch (error) {
        this.logger.error(
          `[Scheduler] ❌ Error publishing to channel ${channel.name}:`,
          error,
        );
        // Continuar para o próximo canal mesmo se houver erro
        // Não criar registro de falha no banco (scheduler não usa banco)
      }
    }

    this.logger.log(
      `[Scheduler] Finished publishing product "${product.name}" to all channels`,
    );
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
