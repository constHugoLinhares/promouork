import { IsOptional, IsString } from 'class-validator';

export class CallbackDto {
  @IsString()
  code: string;

  @IsString()
  @IsOptional()
  shopId?: string;

  @IsString()
  @IsOptional()
  redirectUri?: string;
}
