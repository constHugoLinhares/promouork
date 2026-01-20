import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCopyMessageDto {
  @IsString()
  message: string;

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
