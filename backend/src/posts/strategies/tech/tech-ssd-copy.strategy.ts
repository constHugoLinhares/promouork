import { Injectable } from '@nestjs/common';
import { Product } from '../../types/product.types';
import { CopyStrategy } from '../copy-strategy.interface';

@Injectable()
export class TechSsdCopyStrategy implements CopyStrategy {
  private readonly hooks = [
    'PC rápido começa no armazenamento.',
    'Loading infinito não é normal.',
    'Depois do SSD, nada parece lento.',
  ];

  supports(product: Product): boolean {
    return product.category === 'tech' && product.subcategory === 'ssd';
  }

  generate(product: Product): string {
    const hook = this.hooks[Math.floor(Math.random() * this.hooks.length)];
    const formatPrice = (value: number) =>
      value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });

    let message = `🎮 ${hook}\n\n`;
    message += `🛒 ${product.name}\n\n`;

    if (product.originalPrice) {
      message += `💸 De ${formatPrice(product.originalPrice)}\n`;
      message += `➡️ Por *${formatPrice(product.price)}*\n\n`;
    } else {
      message += `💸 *${formatPrice(product.price)}*\n\n`;
    }

    message += `⚡ Upgrade que dá resultado real.\n\n`;
    message += `👉 Comprar agora 👇\n`;
    message += `${product.link}`;

    return message;
  }
}
