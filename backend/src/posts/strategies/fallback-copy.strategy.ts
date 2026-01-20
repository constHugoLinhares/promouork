import { Injectable } from '@nestjs/common';
import { Product } from '../types/product.types';
import { CopyStrategy } from './copy-strategy.interface';

@Injectable()
export class FallbackCopyStrategy implements CopyStrategy {
  supports(product: Product): boolean {
    // Fallback sempre retorna true, mas só deve ser usado quando nenhuma outra estratégia suporta
    return true;
  }

  generate(product: Product): string {
    const formatPrice = (value: number) =>
      value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });

    let message = `🛒 ${product.name}\n\n`;

    if (product.originalPrice) {
      message += `💸 De ${formatPrice(product.originalPrice)}\n`;
      message += `➡️ Por *${formatPrice(product.price)}*\n\n`;
    } else {
      message += `💸 *${formatPrice(product.price)}*\n\n`;
    }

    message += `👉 Comprar agora 👇\n`;
    message += `${product.link}`;

    return message;
  }
}
