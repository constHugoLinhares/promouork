import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSubcategoryDto {
  @IsString()
  name: string;

  @IsUUID()
  categoryId: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
