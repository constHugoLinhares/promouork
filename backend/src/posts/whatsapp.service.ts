import { Injectable } from '@nestjs/common';
import { EvolutionService } from '../evolution/evolution.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WhatsAppService {
  constructor(
    private readonly evolutionService: EvolutionService,
    private readonly prisma: PrismaService,
  ) {}

  async sendMessage(
    channelId: string,
    title: string,
    message: string,
    imageUrl?: string,
  ): Promise<void> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }
    const phone = channel.chatId;
    const text = title ? `${title}\n\n${message}` : message;
    await this.evolutionService.sendMessage(phone, text, imageUrl);
  }
}
