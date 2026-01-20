/**
 * Helper para detectar fardos e calcular valor por unidade
 */

interface FardoInfo {
  isFardo: boolean;
  isPacote?: boolean;
  quantity?: number;
  unitPrice?: number;
  originalUnitPrice?: number;
}

/**
 * Detecta se um produto é um fardo ou pacote/kit e extrai informações
 * Distingue entre:
 * - Fardos: produtos grandes em quantidade (ex: "fardo de 6 monsters")
 * - Pacotes/Kits: produtos pequenos em quantidade (ex: "3x películas", "kit de 3")
 */
export function detectFardo(productName: string): FardoInfo {
  const name = productName.toLowerCase();

  // Palavras-chave que indicam produtos pequenos (não são fardos)
  const smallProductKeywords = [
    'película',
    'pelicula',
    'capa',
    'protetor',
    'adesivo',
    'sticker',
    'kit',
    'pack',
    'pacote',
  ];

  // Verificar se é um produto pequeno
  const isSmallProduct = smallProductKeywords.some((keyword) =>
    name.includes(keyword),
  );

  // Padrões para detectar fardos (produtos grandes)
  const fardoPatterns = [
    // Fardo de X unidades
    /fardo\s+(?:de\s+)?(\d+)/i,
    // Caixa com X unidades (geralmente para produtos grandes)
    /caixa\s+(?:com\s+)?(\d+)/i,
  ];

  // Padrões para detectar pacotes/kits (produtos pequenos ou médios)
  const pacotePatterns = [
    // Pack de X unidades
    { pattern: /pack\s+(?:de\s+)?(\d+)/i, isPacote: true },
    // Pacote de X unidades
    { pattern: /pacote\s+(?:de\s+)?(\d+)/i, isPacote: true },
    // Kit de X unidades
    { pattern: /kit\s+(?:de\s+)?(\d+)/i, isPacote: true },
    // X unidades no início (ex: "3x Película") - verificar contexto
    { pattern: /^(\d+)\s*x\s+/i, isPacote: null }, // null = verificar contexto
    // X unidades (ex: "6 unidades", "12x") - verificar contexto
    { pattern: /(\d+)\s*(?:x|unidades?|un\.?|und\.?)/i, isPacote: null }, // null = verificar contexto
  ];

  // Primeiro, verificar se é um fardo explícito
  for (const pattern of fardoPatterns) {
    const match = name.match(pattern);
    if (match) {
      const quantity = parseInt(match[1], 10);
      if (quantity > 1) {
        return {
          isFardo: true,
          isPacote: false,
          quantity,
        };
      }
    }
  }

  // Depois, verificar se é um pacote/kit
  for (const { pattern, isPacote: patternIsPacote } of pacotePatterns) {
    const match = name.match(pattern);
    if (match) {
      const quantity = parseInt(match[1], 10);
      if (quantity > 1) {
        // Se o padrão já indica pacote, usar isso
        // Se não, verificar se é produto pequeno
        const isPacote =
          patternIsPacote === true ||
          (patternIsPacote === null && isSmallProduct);
        return {
          isFardo: !isPacote, // Se não é pacote, pode ser fardo
          isPacote: isPacote,
          quantity,
        };
      }
    }
  }

  return { isFardo: false };
}

/**
 * Calcula o preço por unidade de um fardo
 */
export function calculateUnitPrice(price: number, quantity: number): number {
  return price / quantity;
}

/**
 * Formata mensagem de preço incluindo valor por unidade se for fardo
 */
export function formatPriceWithUnit(
  productName: string,
  price: number,
  originalPrice?: number,
): string {
  const fardoInfo = detectFardo(productName);
  const formatPrice = (value: number) =>
    value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

  let priceText = '';

  if ((fardoInfo.isFardo || fardoInfo.isPacote) && fardoInfo.quantity) {
    const unitPrice = calculateUnitPrice(price, fardoInfo.quantity);
    const originalUnitPrice = originalPrice
      ? calculateUnitPrice(originalPrice, fardoInfo.quantity)
      : undefined;

    // Determinar o tipo de embalagem
    const packageType = fardoInfo.isPacote ? 'Pacote' : 'Fardo';
    const packageEmoji = fardoInfo.isPacote ? '📦' : '📦';

    // Preço do pacote/fardo
    if (originalPrice && originalPrice > price) {
      priceText += `💸 De <s>${formatPrice(originalPrice)}</s>\n`;
      priceText += `➡️ Por ${formatPrice(price)}\n\n`;
    } else {
      priceText += `💸 ${formatPrice(price)}\n\n`;
    }

    // Preço por unidade
    priceText += `${packageEmoji} ${packageType} com ${fardoInfo.quantity} unidades\n`;
    if (originalUnitPrice && originalUnitPrice > unitPrice) {
      priceText += `💰 De <s>${formatPrice(originalUnitPrice)}</s> por unidade\n`;
      priceText += `➡️ Por ${formatPrice(unitPrice)} por unidade\n\n`;
    } else {
      priceText += `💰 ${formatPrice(unitPrice)} por unidade\n\n`;
    }
  } else {
    // Produto normal (não é fardo)
    if (originalPrice && originalPrice > price) {
      priceText += `💸 De <s>${formatPrice(originalPrice)}</s>\n`;
      priceText += `➡️ Por ${formatPrice(price)}\n\n`;
    } else {
      priceText += `💸 ${formatPrice(price)}\n\n`;
    }
  }

  return priceText;
}

/**
 * Formata mensagem de preço em Markdown (para compatibilidade)
 */
export function formatPriceWithUnitMarkdown(
  productName: string,
  price: number,
  originalPrice?: number,
): string {
  const fardoInfo = detectFardo(productName);
  const formatPrice = (value: number) =>
    value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

  let priceText = '';

  if ((fardoInfo.isFardo || fardoInfo.isPacote) && fardoInfo.quantity) {
    const unitPrice = calculateUnitPrice(price, fardoInfo.quantity);
    const originalUnitPrice = originalPrice
      ? calculateUnitPrice(originalPrice, fardoInfo.quantity)
      : undefined;

    // Determinar o tipo de embalagem
    const packageType = fardoInfo.isPacote ? 'Pacote' : 'Fardo';
    const packageEmoji = fardoInfo.isPacote ? '📦' : '📦';

    // Preço do pacote/fardo
    if (originalPrice && originalPrice > price) {
      priceText += `💸 De ${formatPrice(originalPrice)}\n`;
      priceText += `➡️ Por *${formatPrice(price)}*\n\n`;
    } else {
      priceText += `💸 *${formatPrice(price)}*\n\n`;
    }

    // Preço por unidade
    priceText += `${packageEmoji} ${packageType} com ${fardoInfo.quantity} unidades\n`;
    if (originalUnitPrice && originalUnitPrice > unitPrice) {
      priceText += `💰 De ${formatPrice(originalUnitPrice)} por unidade\n`;
      priceText += `➡️ Por *${formatPrice(unitPrice)}* por unidade\n\n`;
    } else {
      priceText += `💰 *${formatPrice(unitPrice)}* por unidade\n\n`;
    }
  } else {
    // Produto normal (não é fardo)
    if (originalPrice && originalPrice > price) {
      priceText += `💸 De ${formatPrice(originalPrice)}\n`;
      priceText += `➡️ Por *${formatPrice(price)}*\n\n`;
    } else {
      priceText += `💸 *${formatPrice(price)}*\n\n`;
    }
  }

  return priceText;
}
