import {
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsOptional,
  IsObject,
  Min,
  Max,
} from 'class-validator';

export class CreateSchedulerDto {
  @IsString()
  name: string;

  @IsString()
  integrationId: string;

  @IsNumber()
  intervalMinutes: number;

  @IsArray()
  @IsString({ each: true })
  channelIds: string[];

  @IsObject()
  @IsOptional()
  config?: {
    keywords?: string[]; // Mantido para compatibilidade
    productIds?: string[]; // IDs dos Products cadastrados
    category?: string;
    subcategory?: string;
    limit?: number;
    minCommission?: number;
    minScore?: number;
    minRatingStar?: number; // Rating mínimo (0-5), padrão 4.5
    blockedKeywords?: string[]; // Palavras que devem bloquear produtos
  };

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
