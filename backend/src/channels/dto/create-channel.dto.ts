import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateChannelDto {
  @IsString()
  name: string;

  @IsString()
  @IsIn(['telegram', 'instagram_stories', 'whatsapp', 'facebook', 'twitter'])
  type: string;

  @IsString()
  chatId: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  categoryId: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
