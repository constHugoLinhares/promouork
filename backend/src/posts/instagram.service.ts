import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InstagramService {
  constructor(private configService: ConfigService) {}

  async publishStory(
    channelId: string,
    title: string,
    message: string,
    imageUrl?: string,
  ) {
    // TODO: Implementar integração com Instagram Graph API
    // Por enquanto, apenas simula o envio
    const accessToken = this.configService.get<string>(
      'INSTAGRAM_ACCESS_TOKEN',
    );

    if (!accessToken) {
      throw new Error('Instagram access token not configured');
    }

    // Implementação futura:
    // 1. Combinar título e mensagem: `${title}\n\n${message}`
    // 2. Upload da imagem para o Instagram
    // 3. Criar story com a imagem e texto
    // 4. Retornar o ID da story criada

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = { channelId, title, message, imageUrl };
    throw new Error('Instagram Stories integration not yet implemented');
  }
}
