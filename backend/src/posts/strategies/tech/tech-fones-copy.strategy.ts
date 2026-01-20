import { Injectable } from '@nestjs/common';
import { Product } from '../../types/product.types';
import { CopyStrategy } from '../copy-strategy.interface';

@Injectable()
export class TechFonesCopyStrategy implements CopyStrategy {
  private readonly hooks = [
    'Ouvir antes de ver faz diferença.',
    'Áudio ruim te deixa sempre atrasado.',
    'Imersão também é vantagem.',
  ];

  supports(product: Product): boolean {
    return product.category === 'tech' && product.subcategory === 'fones';
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
