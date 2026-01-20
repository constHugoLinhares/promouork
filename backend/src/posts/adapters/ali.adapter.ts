import { Injectable } from '@nestjs/common';
import { FetchParams, Product, RawProduct } from '../types/product.types';
import { MarketplaceAdapter } from './marketplace-adapter.interface';

@Injectable()
export class AliAdapter implements MarketplaceAdapter {
  name = 'ali';

  async fetchDeals(params: FetchParams): Promise<Product[]> {
    // TODO: Implementar integração com API do AliExpress
    // Por enquanto retorna array vazio
    return [];
  }

  generateAffiliateLink(product: RawProduct): string {
    // TODO: Implementar lógica de geração de link de afiliado do AliExpress
    // Por enquanto retorna o link original
    return product.link;
  }
}
