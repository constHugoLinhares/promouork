/**
 * Helper para gerar mensagens de post baseadas em campos de produto
 */

export interface ProductFields {
  name: string;
  price: number;
  originalPrice?: number;
  link: string;
  category?: string;
  subcategory?: string;
}

export interface MessageGenerationOptions {
  includeHook?: boolean;
  hook?: string;
  includeCallToAction?: boolean;
  customCallToAction?: string;
}

/**
 * Gera uma mensagem formatada baseada nos campos do produto
 */
export function generateProductMessage(
  product: ProductFields,
  options: MessageGenerationOptions = {},
): string {
  const {
    includeHook = true,
    hook,
    includeCallToAction = true,
    customCallToAction,
  } = options;

  const formatPrice = (value: number) =>
    value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

  let message = '';

  // Adicionar hook se solicitado
  if (includeHook && hook) {
    message += `${hook}\n\n`;
  }

  // Nome do produto
  message += `🛒 ${product.name}\n\n`;

  // Preços
  if (product.originalPrice && product.originalPrice > product.price) {
    // Preço original riscado para demonstrar promoção
    message += `💸 De <s>${formatPrice(product.originalPrice)}</s>\n`;
    message += `➡️ Por ${formatPrice(product.price)}\n\n`;
  } else {
    message += `💸 ${formatPrice(product.price)}\n\n`;
  }

  // Call to action
  if (includeCallToAction) {
    const cta = customCallToAction || '👉 Comprar agora 👇';
    message += `${cta}\n`;
  }

  // Link
  message += `${product.link}`;

  return message;
}

/**
 * Obtém um hook aleatório baseado na categoria e subcategoria
 * NOTA: Esta função agora deve ser chamada através do CopyMessagesService
 * que busca os hooks do banco de dados. Esta função é mantida apenas para
 * compatibilidade, mas retorna undefined. Use o serviço diretamente.
 */
export function getRandomHook(): string | undefined {
  // Esta função foi descontinuada - os hooks agora vêm do banco de dados
  // Use CopyMessagesService.getRandomHook() diretamente
  return undefined;
}
