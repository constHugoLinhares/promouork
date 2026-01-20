import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsAppService {
  constructor(private configService: ConfigService) {}

  async sendMessage(
    channelId: string,
    title: string,
    message: string,
    imageUrl?: string,
  ) {
    // TODO: Implementar integração com WhatsApp Business API
    // Por enquanto, apenas simula o envio
    const accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.configService.get<string>(
      'WHATSAPP_PHONE_NUMBER_ID',
    );

    if (!accessToken || !phoneNumberId) {
      throw new Error('WhatsApp credentials not configured');
    }

    // Implementação futura:
    // 1. Combinar título e mensagem: `${title}\n\n${message}`
    // 2. Enviar mensagem via WhatsApp Business API
    // 3. Se houver imagem, enviar como mídia
    // 4. Retornar o ID da mensagem enviada

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = { channelId, title, message, imageUrl };
    throw new Error('WhatsApp integration not yet implemented');
  }
}
