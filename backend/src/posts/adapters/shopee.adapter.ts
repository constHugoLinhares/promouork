import { ApolloClient, gql, InMemoryCache } from '@apollo/client';
import { loadDevMessages, loadErrorMessages } from '@apollo/client/dev';
import { HttpLink } from '@apollo/client/link/http';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';
import { ShopeeCacheService } from '../../shopee/shopee-cache.service';
import { FetchParams, Product, RawProduct } from '../types/product.types';
import { MarketplaceAdapter } from './marketplace-adapter.interface';

// Carregar mensagens de erro do Apollo Client em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  loadDevMessages();
  loadErrorMessages();
}

@Injectable()
export class ShopeeAdapter implements MarketplaceAdapter {
  name = 'shopee';
  private apolloClient: ApolloClient | null = null;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
    private cacheService: ShopeeCacheService,
  ) {}

  /**
   * Inicializa o Apollo Client para fazer queries GraphQL na Shopee
   */
  private getApolloClient(): ApolloClient {
    if (this.apolloClient) {
      return this.apolloClient;
    }

    const partnerId = this.configService.get<string>('SHOPEE_PARTNER_ID');
    const partnerKey = this.configService.get<string>('SHOPEE_PARTNER_KEY');

    if (!partnerId || !partnerKey) {
      throw new Error(
        'SHOPEE_PARTNER_ID and SHOPEE_PARTNER_KEY must be configured',
      );
    }

    // GraphQL endpoint da Shopee (API de afiliados)
    const graphqlEndpoint = 'https://open-api.affiliate.shopee.com.br/graphql';

    // Criar link HTTP customizado para incluir autenticação
    const httpLink = new HttpLink({
      uri: graphqlEndpoint,
      fetch: async (uri, options) => {
        // Obter timestamp atual
        const timestamp = Math.floor(Date.now() / 1000);

        // Obter payload do body
        let payload = '';
        let bodyObj: any = {};

        if (options?.body) {
          bodyObj = JSON.parse(options.body as string);
          // Adicionar operationName se não estiver presente
          if (!bodyObj.operationName && bodyObj.query) {
            // Extrair operationName da query (productOfferV2)
            const operationMatch = bodyObj.query.match(/query\s+(\w+)/);
            if (operationMatch) {
              bodyObj.operationName = operationMatch[1];
            }
          }
          // Garantir que operationName está presente
          if (!bodyObj.operationName) {
            bodyObj.operationName = 'productOfferV2';
          }
          // Payload é o body completo como string JSON
          payload = JSON.stringify(bodyObj);
        }

        // Calcular signature: SHA256(Credential + Timestamp + Payload + Secret)
        const signatureFactor = `${partnerId}${timestamp}${payload}${partnerKey}`;
        const signature = crypto
          .createHash('sha256')
          .update(signatureFactor)
          .digest('hex');

        // Criar Authorization header no formato correto
        const authorizationHeader = `SHA256 Credential=${partnerId}, Timestamp=${timestamp}, Signature=${signature}`;

        // Adicionar headers e parâmetros de autenticação
        const customOptions: any = {
          ...options,
          method: 'POST', // GraphQL da Shopee sempre é POST
          headers: {
            ...options?.headers,
            'Content-Type': 'application/json',
            Authorization: authorizationHeader,
          },
        };

        // Atualizar body com operationName se necessário
        if (payload) {
          customOptions.body = payload;
        }

        return fetch(uri, customOptions);
      },
    });

    this.apolloClient = new ApolloClient({
      link: httpLink,
      cache: new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              productOfferV2: {
                keyArgs: ['keyword', 'scrollId'],
                // Nunca acumular: substituir sempre para limitar uso de memória no servidor
                merge(_, incoming) {
                  return incoming ?? null;
                },
              },
            },
          },
        },
      }),
      defaultOptions: {
        query: {
          fetchPolicy: 'network-only',
        },
      },
    });

    return this.apolloClient;
  }

  /**
   * Cria uma assinatura para requisições da API Shopee
   */
  private createSignature(
    partnerId: string,
    partnerKey: string,
    path: string,
    params: Record<string, any> = {},
  ) {
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partnerId}${path}${timestamp}${params.access_token || ''}${params.shop_id || ''}`;
    const sign = crypto
      .createHmac('sha256', partnerKey)
      .update(baseString)
      .digest('hex');
    return { sign, timestamp };
  }

  /**
   * Busca produtos na Shopee usando GraphQL com Apollo Client
   * Busca páginas recursivamente até encontrar produtos novos que não estejam no cache
   * NUNCA envia produtos já enviados (dentro do TTL de 7 dias)
   */
  async fetchDeals(params: FetchParams): Promise<Product[]> {
    try {
      // Processar keywords: priorizar array de keywords, depois keyword única
      let keywords: string[] = [];

      if (params.keywords && Array.isArray(params.keywords)) {
        // Se há array de keywords, usar ele
        keywords = params.keywords.filter((k) => k && k.trim().length > 0);
      } else if (params.keyword && params.keyword.trim().length > 0) {
        // Se há apenas keyword única, converter para array
        keywords = [params.keyword.trim()];
      }

      if (keywords.length === 0) {
        return [];
      }

      const limit = params.limit || 20;
      const allNewProducts: Product[] = [];

      // Buscar produtos para cada keyword, paginando recursivamente até encontrar produtos novos
      for (const keyword of keywords) {
        if (allNewProducts.length >= limit) {
          break; // Já temos produtos suficientes
        }

        const newProducts = await this.fetchNewProductsRecursively(
          keyword,
          params,
          limit - allNewProducts.length,
        );

        allNewProducts.push(...newProducts);
      }

      // Limitar resultados ao limit solicitado
      return allNewProducts.slice(0, limit);
    } catch (error: any) {
      return [];
    }
  }

  /**
   * Busca produtos recursivamente até encontrar produtos novos que não estejam no cache
   * Se todos os produtos de uma página estão no cache, busca próxima página automaticamente
   * @param keyword - Palavra-chave para busca
   * @param params - Parâmetros de busca
   * @param limit - Limite de produtos novos a encontrar
   * @returns Array de produtos novos (não estão no cache)
   */
  private async fetchNewProductsRecursively(
    keyword: string,
    params: FetchParams,
    limit: number,
  ): Promise<Product[]> {
    const newProducts: Product[] = [];
    let scrollId: string | undefined = undefined;
    let pageAttempts = 0;
    const maxPageAttempts = 50; // Aumentado para buscar mais páginas se necessário

    while (newProducts.length < limit && pageAttempts < maxPageAttempts) {
      pageAttempts++;

      try {
        // Buscar página atual
        const { products, pageInfo } = await this.searchByKeyword(
          keyword,
          params,
          scrollId,
        );

        if (products.length === 0) {
          break; // Não há mais produtos
        }

        // Remover duplicatas baseado no link
        const uniqueProducts = Array.from(
          new Map(products.map((p) => [p.link, p])).values(),
        );

        // Verificar quais produtos NÃO estão no cache (não foram enviados nos últimos 7 dias)
        const productsToCheck = uniqueProducts.map((p) => ({
          link: p.link,
          price: p.price,
          originalPrice: p.originalPrice,
        }));

        // Filtrar produtos que devem ser enviados (não estão no cache)
        const productsToSend =
          await this.cacheService.filterNewOrBetterProducts(productsToCheck);

        // Mapear de volta para produtos completos que devem ser enviados
        const pageNewProducts = uniqueProducts.filter((p) =>
          productsToSend.some(
            (ps) => ps.link === p.link && ps.price === p.price,
          ),
        );

        // Adicionar produtos novos à lista
        newProducts.push(...pageNewProducts);

        // Se encontrou produtos novos suficientes, parar
        if (newProducts.length >= limit) {
          break;
        }

        // Se todos os produtos desta página estão no cache, buscar próxima página
        if (pageNewProducts.length === 0) {
          if (pageInfo.hasNextPage && pageInfo.scrollId) {
            scrollId = pageInfo.scrollId;
          } else {
            break; // Não há mais páginas
          }
        } else {
          // Se encontrou alguns produtos novos mas não suficientes, continuar para próxima página
          if (pageInfo.hasNextPage && pageInfo.scrollId) {
            scrollId = pageInfo.scrollId;
          } else {
            break; // Não há mais páginas
          }
        }
      } catch (error: any) {
        break; // Em caso de erro, parar a busca
      }
    }

    return newProducts;
  }

  /**
   * Busca produtos usando GraphQL com Apollo Client
   * Suporta paginação usando scrollId para pular produtos já enviados
   */
  private async searchByKeyword(
    keyword: string,
    params: FetchParams,
    scrollId?: string,
  ): Promise<{ products: Product[]; pageInfo: any }> {
    try {
      const client = this.getApolloClient();

      // Query GraphQL para busca de produtos usando productOfferV2
      // Se scrollId for fornecido, usar para paginação
      const queryString = scrollId
        ? `
        query productOfferV2($keyword: String!, $scrollId: String!) {
          productOfferV2(keyword: $keyword, scrollId: $scrollId) {
            nodes {
              productName
              itemId
              commissionRate
              commission
              price
              sales
              imageUrl
              shopName
              productLink
              offerLink
              periodStartTime
              periodEndTime
              priceMin
              priceMax
              productCatIds
              ratingStar
              priceDiscountRate
              shopId
              shopType
              sellerCommissionRate
              shopeeCommissionRate
            }
            pageInfo {
              page
              limit
              hasNextPage
              scrollId
            }
          }
        }
      `
        : `
        query productOfferV2($keyword: String!) {
          productOfferV2(keyword: $keyword) {
            nodes {
              productName
              itemId
              commissionRate
              commission
              price
              sales
              imageUrl
              shopName
              productLink
              offerLink
              periodStartTime
              periodEndTime
              priceMin
              priceMax
              productCatIds
              ratingStar
              priceDiscountRate
              shopId
              shopType
              sellerCommissionRate
              shopeeCommissionRate
            }
            pageInfo {
              page
              limit
              hasNextPage
              scrollId
            }
          }
        }
      `;

      const variables: any = { keyword };
      if (scrollId) {
        variables.scrollId = scrollId;
      }

      // Executar query com Apollo Client
      const response = await client.query({
        query: gql(queryString),
        variables,
        // No servidor, sempre buscar dados atualizados da rede
        fetchPolicy: 'network-only',
        // Incluir operationName explicitamente
        context: {
          operationName: 'productOfferV2',
        },
      });

      // Transformar resposta GraphQL para formato Product
      const data = response.data as any;
      const nodes = data?.productOfferV2?.nodes || [];
      const pageInfo = data?.productOfferV2?.pageInfo || {};
      const products = nodes
        .map((item: any) => this.transformToProduct(item, params))
        .filter((product: Product | null) => product !== null) as Product[];

      // Filtrar produtos pela categoria esperada se especificada
      // Isso garante que apenas produtos da categoria correta sejam retornados
      const filteredProducts = params.category
        ? products.filter((product) => product.category === params.category)
        : products;

      return {
        products: filteredProducts,
        pageInfo,
      };
    } catch (error: any) {
      // Se GraphQL falhar, tentar método REST alternativo
      const restProducts = await this.searchByKeywordREST(keyword, params);
      return {
        products: restProducts,
        pageInfo: { hasNextPage: false },
      };
    }
  }

  /**
   * Método alternativo usando REST API (fallback caso GraphQL não esteja disponível)
   */
  private async searchByKeywordREST(
    keyword: string,
    params: FetchParams,
  ): Promise<Product[]> {
    try {
      const partnerId = this.configService.get<string>('SHOPEE_PARTNER_ID');
      const partnerKey = this.configService.get<string>('SHOPEE_PARTNER_KEY');
      const accessToken = this.configService.get<string>('SHOPEE_ACCESS_TOKEN');
      const shopId = this.configService.get<string>('SHOPEE_SHOP_ID');

      if (!partnerId || !partnerKey) {
        throw new Error(
          'SHOPEE_PARTNER_ID and SHOPEE_PARTNER_KEY must be configured',
        );
      }

      const path = '/api/v2/product/search';
      const { sign, timestamp } = this.createSignature(
        partnerId,
        partnerKey,
        path,
        { access_token: accessToken, shop_id: shopId },
      );

      const requestParams: any = {
        partner_id: partnerId,
        timestamp,
        sign,
        keyword,
        page_size: params.limit || 20,
        page_number: 1,
      };

      if (accessToken) {
        requestParams.access_token = accessToken;
      }
      if (shopId) {
        requestParams.shop_id = shopId;
      }

      const response = await firstValueFrom(
        this.httpService.post(
          `https://partner.shopeemobile.com${path}`,
          requestParams,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const items =
        response.data?.response?.items || response.data?.items || [];
      const products = items
        .map((item: any) => this.transformToProduct(item, params))
        .filter((product: Product | null) => product !== null) as Product[];

      // Filtrar produtos pela categoria esperada se especificada
      if (params.category) {
        return products.filter(
          (product) => product.category === params.category,
        );
      }

      return products;
    } catch (error: any) {
      return [];
    }
  }

  /**
   * Infere a categoria do produto baseado no nome e keywords
   * Retorna null se não conseguir inferir ou se claramente não pertence à categoria esperada
   */
  private inferProductCategory(
    productName: string,
    expectedCategory: string,
    keywords?: string[],
  ): string | null {
    const name = productName.toLowerCase();
    const expected = expectedCategory.toLowerCase();

    // Palavras-chave que indicam produtos de tecnologia
    const techKeywords = [
      'fone',
      'headphone',
      'headset',
      'earphone',
      'bluetooth',
      'wireless',
      'carregador',
      'cabo',
      'usb',
      'c',
      'lightning',
      'película',
      'pelicula',
      'capa',
      'protetor',
      'tela',
      'smartphone',
      'celular',
      'tablet',
      'notebook',
      'laptop',
      'mouse',
      'teclado',
      'monitor',
      'webcam',
      'microfone',
      'speaker',
      'caixa de som',
      'smartwatch',
      'relógio inteligente',
      'powerbank',
      'bateria',
      'qcy',
      'xiaomi',
      'samsung',
      'apple',
      'iphone',
      'ipad',
      'macbook',
      'airpods',
      'galaxy',
    ];

    // Palavras-chave que indicam produtos de casa
    const casaKeywords = [
      'chinelo',
      'sandália',
      'sapato',
      'tênis',
      'tenis',
      'roupa',
      'camiseta',
      'calça',
      'bermuda',
      'short',
      'vestido',
      'saia',
      'blusa',
      'casaco',
      'jaqueta',
      'moletom',
      'kit',
      'par',
      'pares',
      'infantil',
      'baby',
      'feminino',
      'masculino',
      'unissex',
      'cama',
      'mesa',
      'cadeira',
      'sofá',
      'sofa',
      'cortina',
      'almofada',
      'toalha',
      'lençol',
      'edredom',
      'travesseiro',
      'vaso',
      'planta',
      'decoração',
      'decoracao',
      'jarra',
      'copo',
      'xícara',
      'xicara',
      'prato',
      'talher',
      'panela',
      'frigideira',
      'fogão',
      'fogao',
      'geladeira',
      'microondas',
      'liquidificador',
      'batedeira',
      'aspirador',
      'vassoura',
      'rodo',
      'balde',
      'esponja',
      'detergente',
      'sabão',
      'sabao',
      'shampoo',
      'condicionador',
      'sabonete',
      'papel higiênico',
      'papel higienico',
    ];

    // Palavras-chave que indicam produtos de basquete
    const basqueteKeywords = [
      'basquete',
      'basketball',
      'nba',
      'jordan',
      'nike',
      'adidas',
      'bola',
      'tênis basquete',
      'tenis basquete',
      'camiseta nba',
      'camisa nba',
      'short basquete',
      'meião',
      'meiao',
      'caneleira',
    ];

    // Verificar se o produto claramente NÃO pertence à categoria esperada
    if (expected === 'tech') {
      // Se contém palavras-chave de outras categorias, não é tech
      if (
        casaKeywords.some((kw) => name.includes(kw)) ||
        basqueteKeywords.some((kw) => name.includes(kw))
      ) {
        return null; // Produto não pertence à categoria tech
      }
      // Se contém palavras-chave de tech ou keywords de busca relacionadas, é tech
      if (
        techKeywords.some((kw) => name.includes(kw)) ||
        keywords?.some((kw) =>
          techKeywords.some((tk) => kw.toLowerCase().includes(tk)),
        )
      ) {
        return 'tech';
      }
    } else if (expected === 'casa') {
      // Se contém palavras-chave de outras categorias, não é casa
      if (
        techKeywords.some((kw) => name.includes(kw)) ||
        basqueteKeywords.some((kw) => name.includes(kw))
      ) {
        return null; // Produto não pertence à categoria casa
      }
      // Se contém palavras-chave de casa ou keywords de busca relacionadas, é casa
      if (
        casaKeywords.some((kw) => name.includes(kw)) ||
        keywords?.some((kw) =>
          casaKeywords.some((ck) => kw.toLowerCase().includes(ck)),
        )
      ) {
        return 'casa';
      }
    } else if (expected === 'basquete') {
      // Se contém palavras-chave de outras categorias, não é basquete
      if (
        techKeywords.some((kw) => name.includes(kw)) ||
        casaKeywords.some((kw) => name.includes(kw))
      ) {
        return null; // Produto não pertence à categoria basquete
      }
      // Se contém palavras-chave de basquete ou keywords de busca relacionadas, é basquete
      if (
        basqueteKeywords.some((kw) => name.includes(kw)) ||
        keywords?.some((kw) =>
          basqueteKeywords.some((bk) => kw.toLowerCase().includes(bk)),
        )
      ) {
        return 'basquete';
      }
    }

    // Se não conseguiu inferir, retornar a categoria esperada (comportamento padrão)
    // Mas isso pode ser perigoso, então vamos ser mais conservadores
    // Se não há indicação clara, retornar null para filtrar
    return null;
  }

  /**
   * Transforma item da API Shopee para formato Product
   * Usa os campos retornados por productOfferV2
   */
  private transformToProduct(item: any, params: FetchParams): Product | null {
    try {
      if (!item.productName || !item.productLink) {
        return null;
      }

      // Preço atual (pode ser price, priceMin ou priceMax)
      // Garantir que seja número
      const currentPrice =
        typeof item.price === 'number'
          ? item.price
          : typeof item.priceMin === 'number'
            ? item.priceMin
            : parseFloat(item.price || item.priceMin || '0') || 0;

      // Calcular preço original se houver desconto
      let originalPrice: number | undefined;
      if (item.priceDiscountRate && item.priceDiscountRate > 0) {
        // Se há desconto, calcular preço original
        originalPrice = currentPrice / (1 - item.priceDiscountRate / 100);
      } else if (item.priceMax) {
        const priceMaxNum =
          typeof item.priceMax === 'number'
            ? item.priceMax
            : parseFloat(item.priceMax) || 0;
        if (priceMaxNum > currentPrice) {
          originalPrice = priceMaxNum;
        }
      }

      // Comissão já vem calculada ou pode ser calculada
      const commission = item.commission || 0;

      // Filtrar por comissão mínima se especificado
      if (params.minCommission && commission < params.minCommission) {
        return null;
      }

      // Usar a categoria esperada dos parâmetros diretamente
      // A inferência de categoria é muito restritiva e pode filtrar produtos válidos
      // Se a categoria foi especificada nos parâmetros, confiar nela
      const expectedCategory = params.category || 'tech';
      const category = expectedCategory as Product['category'];

      return {
        marketplace: 'shopee',
        name: item.productName,
        price: currentPrice,
        originalPrice:
          originalPrice && originalPrice > currentPrice
            ? originalPrice
            : undefined,
        category: category,
        subcategory: params.subcategory || 'general',
        // Usar offerLink se disponível (link de afiliado)
        link: item.offerLink || item.productLink,
        score: this.calculateScore(item, commission),
        imageUrl: item.imageUrl,
        itemId: item.itemId ? String(item.itemId) : undefined,
        ratingStar: item.ratingStar ? Number(item.ratingStar) : undefined,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Calcula score do produto baseado em vários fatores
   * Usa os campos retornados por productOfferV2
   */
  private calculateScore(item: any, commission: number): number {
    let score = 0;

    // Score de comissão
    score += commission * 0.1;

    // Score de avaliação
    if (item.ratingStar) {
      score += item.ratingStar * 2;
    }

    // Score de vendas
    if (item.sales) {
      score += Math.min(item.sales / 100, 10);
    }

    // Score de desconto
    if (item.priceDiscountRate && item.priceDiscountRate > 0) {
      score += item.priceDiscountRate * 0.1;
    }

    // Score de comissão (taxa)
    if (item.commissionRate) {
      score += item.commissionRate * 0.5;
    }

    return Math.round(score * 100) / 100;
  }

  /**
   * Gera link de afiliado para produto Shopee
   */
  generateAffiliateLink(product: RawProduct): string {
    const affiliateId = this.configService.get<string>('SHOPEE_AFFILIATE_ID');

    if (affiliateId && product.link) {
      const url = new URL(product.link);
      url.searchParams.set('affiliate_id', affiliateId);
      return url.toString();
    }

    return product.link;
  }
}
