import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateIntegrationChannelConfigDto {
  @IsString()
  integrationId: string;

  @IsString()
  channelId: string;

  @IsObject()
  config: Record<string, any>; // Configurações específicas (ex: { keywords: ["bola de basquete"] } para Shopee)

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
