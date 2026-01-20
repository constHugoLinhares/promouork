import { Injectable } from '@nestjs/common';
import { FetchParams, Product, RawProduct } from '../types/product.types';
import { MarketplaceAdapter } from './marketplace-adapter.interface';

@Injectable()
export class MLAdapter implements MarketplaceAdapter {
  name = 'ml';

  async fetchDeals(params: FetchParams): Promise<Product[]> {
    // TODO: Implementar integração com API do Mercado Livre
    // Por enquanto retorna array vazio
    return [];
  }

  generateAffiliateLink(product: RawProduct): string {
    // TODO: Implementar lógica de geração de link de afiliado do Mercado Livre
    // Por enquanto retorna o link original
    return product.link;
  }
}
