/**
 * Normaliza uma URL garantindo que tenha o protocolo https://
 * Se a URL já tiver http:// ou https://, mantém como está
 * Se não tiver protocolo, adiciona https://
 */
export function normalizeUrl(url: string): string {
  if (!url || url.trim() === '') {
    return url;
  }

  const trimmedUrl = url.trim();

  // Se já tiver protocolo, retornar como está
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    return trimmedUrl;
  }

  // Se não tiver protocolo, adicionar https://
  return `https://${trimmedUrl}`;
}
