import { Injectable } from '@nestjs/common';
import { FetchParams, Product, RawProduct } from '../types/product.types';
import { MarketplaceAdapter } from './marketplace-adapter.interface';

@Injectable()
export class AmazonAdapter implements MarketplaceAdapter {
  name = 'amazon';

  async fetchDeals(params: FetchParams): Promise<Product[]> {
    // TODO: Implementar integração com API da Amazon
    // Por enquanto retorna array vazio
    return [];
  }

  generateAffiliateLink(product: RawProduct): string {
    // TODO: Implementar lógica de geração de link de afiliado da Amazon
    // Por enquanto retorna o link original
    return product.link;
  }
}
