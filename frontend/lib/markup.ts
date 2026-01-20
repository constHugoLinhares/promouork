/**
 * Informações sobre suporte a markup por tipo de canal
 */

export type MarkupType = 'html' | 'markdown' | 'plain';

export interface ChannelMarkupInfo {
  supported: MarkupType[];
  recommended: MarkupType;
  description: string;
  icon: string;
}

export const CHANNEL_MARKUP_SUPPORT: Record<string, ChannelMarkupInfo> = {
  telegram: {
    supported: ['html', 'markdown'],
    recommended: 'html',
    description: 'Telegram suporta HTML e Markdown. HTML é mais simples e recomendado.',
    icon: '📱',
  },
  whatsapp: {
    supported: ['plain'],
    recommended: 'plain',
    description: 'WhatsApp não suporta formatação avançada. Use texto simples.',
    icon: '💬',
  },
  instagram_stories: {
    supported: ['plain'],
    recommended: 'plain',
    description: 'Instagram Stories não suporta formatação no texto.',
    icon: '📸',
  },
  facebook: {
    supported: ['plain'],
    recommended: 'plain',
    description: 'Facebook tem suporte limitado a formatação.',
    icon: '👥',
  },
  twitter: {
    supported: ['plain'],
    recommended: 'plain',
    description: 'Twitter não suporta formatação HTML/Markdown.',
    icon: '🐦',
  },
};

export function getChannelMarkupInfo(channelType: string): ChannelMarkupInfo {
  return (
    CHANNEL_MARKUP_SUPPORT[channelType] || {
      supported: ['plain'],
      recommended: 'plain',
      description: 'Formato não especificado. Usando texto simples.',
      icon: '📢',
    }
  );
}

export function getRecommendedMarkupForChannels(
  channelTypes: string[],
): MarkupType {
  if (channelTypes.length === 0) return 'html';

  // Se todos os canais suportam HTML, usar HTML
  const allSupportHTML = channelTypes.every(
    (type) => getChannelMarkupInfo(type).supported.includes('html'),
  );
  if (allSupportHTML) return 'html';

  // Se todos os canais suportam Markdown, usar Markdown
  const allSupportMarkdown = channelTypes.every(
    (type) => getChannelMarkupInfo(type).supported.includes('markdown'),
  );
  if (allSupportMarkdown) return 'markdown';

  // Caso contrário, usar texto simples
  return 'plain';
}

