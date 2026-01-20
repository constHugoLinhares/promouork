import { IsString, IsOptional, IsUUID, IsBoolean } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsUUID()
  channelId: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  subcategoryId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
