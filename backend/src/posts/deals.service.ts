import { Injectable } from '@nestjs/common';
import { IntegrationsService } from '../integrations/integrations.service';
import { AliAdapter } from './adapters/ali.adapter';
import { AmazonAdapter } from './adapters/amazon.adapter';
import { MarketplaceAdapter } from './adapters/marketplace-adapter.interface';
import { MLAdapter } from './adapters/ml.adapter';
import { ShopeeAdapter } from './adapters/shopee.adapter';
import { CopyStrategy } from './strategies/copy-strategy.interface';
import { FallbackCopyStrategy } from './strategies/fallback-copy.strategy';
import { TechCpuCopyStrategy } from './strategies/tech/tech-cpu-copy.strategy';
import { TechFonesCopyStrategy } from './strategies/tech/tech-fones-copy.strategy';
import { TechGpuCopyStrategy } from './strategies/tech/tech-gpu-copy.strategy';
import { TechMonitorCopyStrategy } from './strategies/tech/tech-monitor-copy.strategy';
import { TechMouseCopyStrategy } from './strategies/tech/tech-mouse-copy.strategy';
import { TechSsdCopyStrategy } from './strategies/tech/tech-ssd-copy.strategy';
import { TechTecladoCopyStrategy } from './strategies/tech/tech-teclado-copy.strategy';
import { FetchParams, Product, RawProduct } from './types/product.types';

@Injectable()
export class DealsService {
  private readonly adapters: Map<string, MarketplaceAdapter>;
  private readonly copyStrategies: CopyStrategy[];

  constructor(
    private readonly shopeeAdapter: ShopeeAdapter,
    private readonly amazonAdapter: AmazonAdapter,
    private readonly mlAdapter: MLAdapter,
    private readonly aliAdapter: AliAdapter,
    private readonly integrationsService: IntegrationsService,
    private readonly techCpuCopyStrategy: TechCpuCopyStrategy,
    private readonly techGpuCopyStrategy: TechGpuCopyStrategy,
    private readonly techMonitorCopyStrategy: TechMonitorCopyStrategy,
    private readonly techTecladoCopyStrategy: TechTecladoCopyStrategy,
    private readonly techMouseCopyStrategy: TechMouseCopyStrategy,
    private readonly techFonesCopyStrategy: TechFonesCopyStrategy,
    private readonly techSsdCopyStrategy: TechSsdCopyStrategy,
    private readonly fallbackCopyStrategy: FallbackCopyStrategy,
  ) {
    // Inicializar mapa de adapters
    this.adapters = new Map();
    this.adapters.set('shopee', this.shopeeAdapter);
    this.adapters.set('amazon', this.amazonAdapter);
    this.adapters.set('ml', this.mlAdapter);
    this.adapters.set('ali', this.aliAdapter);

    // Inicializar lista de estratégias de copy (fallback por último)
    this.copyStrategies = [
      this.techCpuCopyStrategy,
      this.techGpuCopyStrategy,
      this.techMonitorCopyStrategy,
      this.techTecladoCopyStrategy,
      this.techMouseCopyStrategy,
      this.techFonesCopyStrategy,
      this.techSsdCopyStrategy,
      this.fallbackCopyStrategy, // Fallback sempre por último
    ];
  }

  /**
   * Busca deals de um marketplace específico
   */
  async fetchDeals(
    marketplace: string,
    params: FetchParams,
  ): Promise<Product[]> {
    const adapter = this.adapters.get(marketplace);
    if (!adapter) {
      throw new Error(`Marketplace adapter not found: ${marketplace}`);
    }

    return adapter.fetchDeals(params);
  }

  /**
   * Gera link de afiliado para um produto
   */
  generateAffiliateLink(marketplace: string, product: RawProduct): string {
    const adapter = this.adapters.get(marketplace);
    if (!adapter) {
      throw new Error(`Marketplace adapter not found: ${marketplace}`);
    }

    return adapter.generateAffiliateLink(product);
  }

  /**
   * Gera mensagem de copy para um produto usando a estratégia apropriada
   * IMPORTANTE: Apenas estratégias que correspondem EXATAMENTE à subcategoria do produto serão usadas.
   * Se a subcategoria for 'general' ou não houver estratégia específica, usa fallback.
   */
  generateCopy(product: Product): string {
    // Se subcategoria é 'general' ou vazia, usar apenas fallback
    // Não tentar inferir ou usar estratégias específicas
    if (!product.subcategory || product.subcategory === 'general') {
      console.log(
        `[CopyStrategy] Product has subcategory 'general' or empty - using fallback for: ${product.name}`,
      );
      return this.fallbackCopyStrategy.generate(product);
    }

    // Filtrar estratégias que suportam o produto
    // IMPORTANTE: Excluir fallback da busca inicial para garantir que apenas estratégias específicas sejam usadas
    const specificStrategies = this.copyStrategies.filter(
      (s) => s !== this.fallbackCopyStrategy && s.supports(product),
    );

    // Se encontrou uma estratégia específica, usar ela
    if (specificStrategies.length > 0) {
      const strategy = specificStrategies[0];
      console.log(
        `[CopyStrategy] Using specific strategy '${strategy.constructor.name}' for product: ${product.category}/${product.subcategory}`,
      );
      return strategy.generate(product);
    }

    // Se não encontrou estratégia específica, usar fallback
    console.warn(
      `[CopyStrategy] No specific strategy found for product: ${product.category}/${product.subcategory} - using fallback`,
    );

    // Usar fallback como última opção
    return this.fallbackCopyStrategy.generate(product);
  }

  /**
   * Processa um produto: gera link de afiliado e copy
   */
  processProduct(
    rawProduct: RawProduct,
    marketplace: string,
  ): { product: Product; copy: string } {
    const affiliateLink = this.generateAffiliateLink(marketplace, rawProduct);

    const product: Product = {
      marketplace: marketplace as Product['marketplace'],
      name: rawProduct.name,
      price: rawProduct.price,
      originalPrice: rawProduct.originalPrice,
      category: rawProduct.category,
      subcategory: rawProduct.subcategory,
      link: affiliateLink,
      score: rawProduct.score,
    };

    const copy = this.generateCopy(product);

    return { product, copy };
  }

  /**
   * Busca deals de uma integração específica considerando as configurações
   * Aplica filtros de comissão mínima e usa o nicho configurado para o canal
   * @param integrationId - ID da integração
   * @param channelId - ID do canal (opcional, para usar o nicho configurado)
   * @param params - Parâmetros adicionais de busca
   * @returns Array de produtos filtrados
   */
  async fetchDealsByIntegration(
    integrationId: string,
    channelId?: string,
    params: FetchParams = {},
  ): Promise<Product[]> {
    // Buscar a integração
    const integration = await this.integrationsService.findOne(integrationId);
    if (!integration || !integration.isActive) {
      throw new Error(`Integration ${integrationId} not found or inactive`);
    }

    // Se channelId foi fornecido, buscar o canal e suas categorias
    let channel = null;
    let channelConfig = null;
    if (channelId) {
      const channels =
        await this.integrationsService.findChannelsByIntegration(integrationId);
      channel = channels.find((c) => c.id === channelId);

      // Buscar configuração específica desta integração para este canal
      if (channel) {
        channelConfig =
          await this.integrationsService.findIntegrationChannelConfig(
            integrationId,
            channelId,
          );
      }
    }

    // Determinar categoria e subcategoria baseado nas categorias do canal
    const category = channel?.category?.slug || params.category;
    // Se o canal tem uma categoria, podemos usar as subcategorias dessa categoria
    // Por enquanto, vamos usar a primeira subcategoria se houver
    const subcategory =
      channel?.category?.subcategories?.[0]?.slug || params.subcategory;

    // Extrair keywords: priorizar keywords dos params (do scheduler), depois do channelConfig
    const channelConfigData = channelConfig?.config as any;
    const keywords =
      params.keywords &&
      Array.isArray(params.keywords) &&
      params.keywords.length > 0
        ? params.keywords // Priorizar keywords do scheduler
        : channelConfigData?.keywords ||
          params.keywords ||
          (params.keyword ? [params.keyword] : undefined);

    // Buscar produtos do marketplace
    const marketplace = integration.type;
    const products = await this.fetchDeals(marketplace, {
      ...params,
      category: category as FetchParams['category'],
      subcategory,
      keywords, // Passar keywords para o adapter
    });

    // Aplicar filtros da configuração da integração
    const config = (integration.config as any) || {};
    const minCommission = config.minCommission || 0;
    const minScore = config.minScore || params.minScore || 0;

    // Filtrar produtos baseado nas configurações
    const filteredProducts = products.filter((product) => {
      // Filtrar por comissão mínima (se o produto tiver informação de comissão)
      // A comissão pode estar no score ou em um campo específico
      if (minCommission > 0) {
        // Assumindo que a comissão está relacionada ao score ou precisa ser calculada
        // Isso pode precisar ser ajustado baseado na estrutura real dos produtos
        const commission = this.calculateCommission(product, config);
        if (commission < minCommission) {
          return false;
        }
      }

      // Filtrar por score mínimo
      if (minScore > 0 && (!product.score || product.score < minScore)) {
        return false;
      }

      return true;
    });

    return filteredProducts;
  }

  /**
   * Calcula a comissão de um produto baseado na configuração
   * Isso pode ser expandido para diferentes tipos de cálculo
   */
  private calculateCommission(product: Product, config: any): number {
    // Exemplo: calcular comissão baseado no preço e taxa de comissão
    const commissionRate = config.commissionRate || 0;
    if (commissionRate > 0) {
      return (product.price * commissionRate) / 100;
    }

    // Se não houver taxa configurada, usar o score como proxy
    return product.score || 0;
  }
}
