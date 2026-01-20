import { Product } from '../types/product.types';

export interface CopyStrategy {
  supports(product: Product): boolean;
  generate(product: Product): string;
}
