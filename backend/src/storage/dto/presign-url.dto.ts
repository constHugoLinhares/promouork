import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum ImageType {
  POST = 'post',
  TEMPLATE = 'template',
}

export class PresignUrlDto {
  @IsEnum(ImageType)
  @IsNotEmpty()
  type: ImageType;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  contentType: string;
}
