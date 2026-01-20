export type Marketplace = 'shopee' | 'amazon' | 'ml' | 'ali';
export type Category = 'tech' | 'casa' | 'basquete';

export type Product = {
  marketplace: Marketplace;
  name: string;
  price: number;
  originalPrice?: number;
  category: Category;
  subcategory: string;
  link: string;
  score?: number;
  imageUrl?: string;
  itemId?: string; // ID do item na Shopee (para cache e validação)
  ratingStar?: number; // Rating do produto na Shopee (0-5)
};

export type RawProduct = {
  name: string;
  price: number;
  originalPrice?: number;
  category: Category;
  subcategory: string;
  link: string;
  score?: number;
  [key: string]: any; // Para campos adicionais específicos de cada marketplace
};

export type FetchParams = {
  category?: Category;
  subcategory?: string;
  limit?: number;
  minScore?: number;
  minCommission?: number; // Comissão mínima em valor absoluto (ex: 10.50)
  commissionRate?: number; // Taxa de comissão em porcentagem (ex: 10 para 10%)
  keyword?: string; // Keyword única para busca (ex: "bola de basquete")
  keywords?: string[]; // Array de keywords para busca (ex: ["bola de basquete", "tênis nike"])
  [key: string]: any; // Para parâmetros específicos de cada marketplace
};
