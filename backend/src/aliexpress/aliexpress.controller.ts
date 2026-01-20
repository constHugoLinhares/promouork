import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AliexpressService } from './aliexpress.service';
import { CallbackDto } from './dto/callback.dto';

@Controller('aliexpress')
@UseGuards(JwtAuthGuard)
export class AliexpressController {
  constructor(private readonly aliexpressService: AliexpressService) {}

  /**
   * GET /aliexpress/authorize
   * Returns the OAuth authorization URL for AliExpress
   * The frontend should redirect the user to this URL
   *
   * @param redirectUri - Optional redirect URI (uses env ALI_REDIRECT_URI if not provided)
   * @returns Object with authorization URL and state
   */
  @Get('authorize')
  getAuthorizationUrl(@Query('redirectUri') redirectUri?: string) {
    return this.aliexpressService.generateAuthorizationUrl(redirectUri);
  }

  /**
   * POST /aliexpress/callback
   * Exchanges authorization code for access token
   *
   * @param body - Object containing code and optional redirectUri
   * @returns Object with access_token and refresh_token
   */
  @Post('callback')
  async handleCallback(@Body() callbackDto: CallbackDto) {
    return this.aliexpressService.exchangeCodeForToken(
      callbackDto.code,
      callbackDto.redirectUri,
    );
  }
}
