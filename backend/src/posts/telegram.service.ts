import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import {
  formatMessage,
  FormattedMessage,
  MarkupType,
} from './formatters/message.formatter';

@Injectable()
export class TelegramService {
  private bot: Telegraf;

  constructor(private configService: ConfigService) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (token) {
      this.bot = new Telegraf(token);
    }
  }

  async sendMessage(
    chatId: string,
    title: string,
    message: string,
    imageUrl?: string,
    markupType: MarkupType = MarkupType.HTML,
  ) {
    if (!this.bot) {
      throw new Error('Telegram bot token not configured');
    }

    try {
      // Formatar mensagem com título
      const formatted: FormattedMessage = formatMessage(
        title,
        message,
        markupType,
      );

      // Validar e processar imageUrl
      if (imageUrl && this.isValidImageUrl(imageUrl)) {
        try {
          // Tentar enviar foto com legenda
          await this.bot.telegram.sendPhoto(chatId, imageUrl, {
            caption: formatted.formatted,
            parse_mode: formatted.parseMode,
          });
          return; // Sucesso, sair da função
        } catch (photoError: any) {
          // Se falhar ao enviar foto, logar o erro e tentar enviar apenas texto
          console.warn(
            `Failed to send photo to Telegram, falling back to text only: ${photoError.message}`,
          );
          // Continuar para enviar apenas texto
        }
      }

      // Enviar apenas texto (se não houver imagem ou se o envio da imagem falhar)
      await this.bot.telegram.sendMessage(chatId, formatted.formatted, {
        parse_mode: formatted.parseMode,
      });
    } catch (error: any) {
      throw new Error(`Failed to send message to Telegram: ${error.message}`);
    }
  }

  /**
   * Valida se a URL da imagem é válida e acessível pelo Telegram
   * Telegram não aceita data URLs (base64) diretamente
   */
  private isValidImageUrl(url: string): boolean {
    if (!url || url.trim() === '') {
      return false;
    }

    // Telegram não aceita data URLs (base64)
    if (url.startsWith('data:image/')) {
      console.warn(
        'Data URL detected. Telegram requires HTTP/HTTPS URLs. Image will be skipped.',
      );
      return false;
    }

    // Verificar se é uma URL HTTP/HTTPS válida
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      // URL inválida
      console.warn(`Invalid image URL format: ${url}`);
      return false;
    }
  }
}
