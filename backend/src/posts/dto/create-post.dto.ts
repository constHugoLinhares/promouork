import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

class ProductDto {
  @IsString()
  name: string;

  @IsNumber()
  price: number;

  @IsNumber()
  @IsOptional()
  originalPrice?: number;

  @IsString()
  link: string;

  @IsUUID()
  categoryId: string;

  @IsUUID()
  @IsOptional()
  subcategoryId?: string;

  @IsString()
  @IsOptional()
  marketplace?: string;
}

class OverlayImageDto {
  @IsString()
  url: string;

  @IsNumber()
  left: number;

  @IsNumber()
  top: number;

  @IsNumber()
  width: number;

  @IsNumber()
  height: number;

  @IsNumber()
  @IsOptional()
  scaleX?: number;

  @IsNumber()
  @IsOptional()
  scaleY?: number;

  @IsNumber()
  @IsOptional()
  angle?: number;
}

export class CreatePostDto {
  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ValidateIf(
    (o) =>
      o.templateId !== '' &&
      o.templateId !== null &&
      o.templateId !== undefined,
  )
  @IsUUID()
  @IsOptional()
  templateId?: string;

  // Imagem sobreposta ao template (apenas para posts com template)
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => OverlayImageDto)
  overlayImage?: OverlayImageDto;

  // Campos de produto (opcionais)
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductDto)
  product?: ProductDto;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  channelIds?: string[];
}
