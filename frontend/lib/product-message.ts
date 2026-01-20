/**
 * Helper para gerar mensagens de post baseadas em campos de produto (frontend)
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
  options: MessageGenerationOptions = {}
): string {
  const {
    includeHook = true,
    hook,
    includeCallToAction = true,
    customCallToAction,
  } = options;

  const formatPrice = (value: number) =>
    value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  let message = "";

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
    const cta = customCallToAction || "👉 Comprar agora 👇";
    message += `${cta}\n`;
  }

  // Link
  message += `${product.link}`;

  return message;
}

/**
 * Obtém um hook aleatório baseado na categoria e subcategoria
 * Agora busca do backend através da API
 */
export async function getRandomHook(
  categorySlug?: string,
  subcategorySlug?: string
): Promise<string | undefined> {
  if (!categorySlug) return undefined;

  try {
    const api = (await import("./api")).default;
    const response = await api.get(
      `/copy-messages/random-hook?categorySlug=${categorySlug}${
        subcategorySlug ? `&subcategorySlug=${subcategorySlug}` : ""
      }`
    );
    return response.data || undefined;
  } catch (error) {
    console.error("Error fetching random hook:", error);
    return undefined;
  }
}
