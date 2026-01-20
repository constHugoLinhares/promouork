import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  background?: string;

  @IsInt()
  @Min(100)
  @IsOptional()
  width?: number;

  @IsInt()
  @Min(100)
  @IsOptional()
  height?: number;

  // elements pode ser array ou objeto (JSON)
  @IsOptional()
  elements?: any;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
