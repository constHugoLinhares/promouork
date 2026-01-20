import { Injectable } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { InstagramService } from './instagram.service';
import { WhatsAppService } from './whatsapp.service';
import { MarkupType } from './formatters/message.formatter';

export interface PublishResult {
  success: boolean;
  error?: string;
}

@Injectable()
export class PublisherService {
  constructor(
    private telegramService: TelegramService,
    private instagramService: InstagramService,
    private whatsappService: WhatsAppService,
  ) {}

  async publishToChannel(
    channelType: string,
    channelId: string,
    title: string,
    message: string,
    imageUrl?: string,
    markupType: MarkupType = MarkupType.HTML,
  ): Promise<PublishResult> {
    try {
      switch (channelType) {
        case 'telegram':
          await this.telegramService.sendMessage(
            channelId,
            title,
            message,
            imageUrl,
            markupType,
          );
          return { success: true };

        case 'instagram_stories':
          await this.instagramService.publishStory(
            channelId,
            title,
            message,
            imageUrl,
          );
          return { success: true };

        case 'whatsapp':
          await this.whatsappService.sendMessage(
            channelId,
            title,
            message,
            imageUrl,
          );
          return { success: true };

        default:
          return {
            success: false,
            error: `Unsupported channel type: ${channelType}`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to publish',
      };
    }
  }
}

