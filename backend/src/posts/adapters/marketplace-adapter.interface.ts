import { FetchParams, Product, RawProduct } from '../types/product.types';

export interface MarketplaceAdapter {
  name: string;
  fetchDeals(params: FetchParams): Promise<Product[]>;
  generateAffiliateLink(product: RawProduct): string;
}
