/**
 * Formatadores de mensagem para diferentes tipos de markup
 */

export enum MarkupType {
  HTML = 'html',
  MARKDOWN = 'markdown',
  PLAIN = 'plain',
}

export interface FormattedMessage {
  formatted: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

/**
 * Adiciona espaços (tab) para cada quebra de linha no corpo da mensagem
 * Adiciona 4 espaços no início de TODAS as linhas da mensagem
 */
function addTabsToLineBreaks(text: string): string {
  if (!text || text.trim() === '') {
    return text;
  }

  // Dividir por quebras de linha e adicionar 4 espaços no início de TODAS as linhas
  const lines = text.split('\n');
  return lines
    .map((line) => {
      // Adicionar 4 espaços no início de cada linha (incluindo a primeira)
      return '    ' + line;
    })
    .join('\n');
}

/**
 * Formata uma mensagem com título usando HTML
 * Estilização simples e intuitiva para leigos
 * Permite tags HTML básicas na mensagem
 */
export function formatAsHTML(title: string, message: string): FormattedMessage {
  // Escapar caracteres especiais HTML, mas preservar tags HTML permitidas
  const escapeHtml = (text: string) => {
    // Primeiro escapar tudo
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    // Restaurar tags HTML permitidas (b, strong, i, em, u, s, code)
    escaped = escaped
      .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/gi, '<b>$1</b>')
      .replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/gi, '<strong>$1</strong>')
      .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/gi, '<i>$1</i>')
      .replace(/&lt;em&gt;(.*?)&lt;\/em&gt;/gi, '<em>$1</em>')
      .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, '<u>$1</u>')
      .replace(/&lt;s&gt;(.*?)&lt;\/s&gt;/gi, '<s>$1</s>')
      .replace(/&lt;code&gt;(.*?)&lt;\/code&gt;/gi, '<code>$1</code>');

    return escaped;
  };

  const escapedTitle = escapeHtml(title);

  // Se a mensagem estiver vazia, retornar apenas o título formatado
  if (!message || message.trim() === '') {
    return {
      formatted: `<b>${escapedTitle}</b>`,
      parseMode: 'HTML',
    };
  }

  // Processar mensagem linha por linha - adicionar 4 espaços em TODAS as linhas
  const lines = message.split('\n');
  const processedLines = lines.map((line) => {
    // Adicionar 4 espaços no início de cada linha (incluindo a primeira)
    return '    ' + line;
  });

  // Juntar linhas
  const messageWithTabs = processedLines.join('\n');

  // Escapar HTML - o Telegram HTML preserva espaços normalmente
  // Não precisamos converter para &nbsp; pois o Telegram HTML já preserva espaços
  const escapedMessage = escapeHtml(messageWithTabs);

  // Formatação HTML simples e intuitiva
  // Título em negrito
  // Quebra de linha padrão entre título e mensagem
  const formatted = `<b>${escapedTitle}</b>\n\n${escapedMessage}`;

  return {
    formatted,
    parseMode: 'HTML',
  };
}

/**
 * Formata uma mensagem com título usando Markdown
 * Compatível com Telegram e outros serviços
 * Não escapa o texto - permite que o usuário use Markdown diretamente
 */
export function formatAsMarkdown(
  title: string,
  message: string,
): FormattedMessage {
  // Se a mensagem estiver vazia, retornar apenas o título formatado
  if (!message || message.trim() === '') {
    return {
      formatted: `*${title}*`,
      parseMode: 'Markdown',
    };
  }

  // Adicionar tabs nas quebras de linha do corpo da mensagem
  const messageWithTabs = addTabsToLineBreaks(message);

  // Título em negrito usando Markdown
  // Não escapamos para permitir que o usuário use Markdown na mensagem
  // Quebra de linha padrão entre título e mensagem
  const formatted = `*${title}*\n\n${messageWithTabs}`;

  return {
    formatted,
    parseMode: 'Markdown',
  };
}

/**
 * Formata uma mensagem sem markup (texto puro)
 */
export function formatAsPlain(
  title: string,
  message: string,
): FormattedMessage {
  // Se a mensagem estiver vazia, retornar apenas o título
  if (!message || message.trim() === '') {
    return {
      formatted: title,
    };
  }

  // Adicionar tabs nas quebras de linha do corpo da mensagem
  const messageWithTabs = addTabsToLineBreaks(message);
  // Quebra de linha padrão entre título e mensagem
  const formatted = `${title}\n\n${messageWithTabs}`;
  return {
    formatted,
  };
}

/**
 * Formata mensagem baseado no tipo de markup
 */
export function formatMessage(
  title: string,
  message: string,
  markupType: MarkupType = MarkupType.HTML,
): FormattedMessage {
  switch (markupType) {
    case MarkupType.HTML:
      return formatAsHTML(title, message);
    case MarkupType.MARKDOWN:
      return formatAsMarkdown(title, message);
    case MarkupType.PLAIN:
      return formatAsPlain(title, message);
    default:
      return formatAsHTML(title, message);
  }
}

/**
 * Retorna informações sobre suporte a markup por tipo de canal
 */
export function getChannelMarkupSupport(channelType: string): {
  supported: MarkupType[];
  recommended: MarkupType;
  description: string;
} {
  switch (channelType) {
    case 'telegram':
      return {
        supported: [MarkupType.HTML, MarkupType.MARKDOWN],
        recommended: MarkupType.HTML,
        description:
          'Telegram suporta HTML e Markdown. HTML é mais simples e recomendado.',
      };
    case 'whatsapp':
      return {
        supported: [MarkupType.PLAIN],
        recommended: MarkupType.PLAIN,
        description:
          'WhatsApp não suporta formatação avançada. Use texto simples.',
      };
    case 'instagram_stories':
      return {
        supported: [MarkupType.PLAIN],
        recommended: MarkupType.PLAIN,
        description: 'Instagram Stories não suporta formatação no texto.',
      };
    case 'facebook':
      return {
        supported: [MarkupType.PLAIN],
        recommended: MarkupType.PLAIN,
        description: 'Facebook tem suporte limitado a formatação.',
      };
    case 'twitter':
      return {
        supported: [MarkupType.PLAIN],
        recommended: MarkupType.PLAIN,
        description: 'Twitter não suporta formatação HTML/Markdown.',
      };
    default:
      return {
        supported: [MarkupType.PLAIN],
        recommended: MarkupType.PLAIN,
        description: 'Formato não especificado. Usando texto simples.',
      };
  }
}
