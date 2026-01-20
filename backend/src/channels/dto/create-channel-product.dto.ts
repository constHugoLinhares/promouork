import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateChannelProductDto {
  @IsString()
  name: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
