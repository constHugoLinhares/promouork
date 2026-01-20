import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CallbackDto } from './dto/callback.dto';
import { ShopeeService } from './shopee.service';

@Controller('shopee')
@UseGuards(JwtAuthGuard)
export class ShopeeController {
  constructor(private readonly shopeeService: ShopeeService) {}

  /**
   * GET /shopee/authorize
   * Returns the OAuth authorization URL for Shopee
   * The frontend should redirect the user to this URL
   *
   * @param redirectUri - Optional redirect URI (uses env SHOPEE_REDIRECT_URI if not provided)
   * @returns Object with authorization URL and state
   */
  @Get('authorize')
  getAuthorizationUrl(@Query('redirectUri') redirectUri?: string) {
    return this.shopeeService.generateAuthorizationUrl(redirectUri);
  }

  /**
   * POST /shopee/callback
   * Exchanges authorization code for access token
   *
   * @param body - Object containing code, shopId and optional redirectUri
   * @returns Object with access_token and refresh_token
   */
  @Post('callback')
  async handleCallback(@Body() callbackDto: CallbackDto) {
    if (!callbackDto.shopId) {
      throw new Error('shopId is required for Shopee callback');
    }
    return this.shopeeService.exchangeCodeForToken(
      callbackDto.code,
      callbackDto.shopId,
      callbackDto.redirectUri,
    );
  }

  /**
   * POST /shopee/refresh
   * Refreshes the access token using refresh token
   *
   * @param body - Object containing refreshToken and shopId
   * @returns Object with new access_token and refresh_token
   */
  @Post('refresh')
  async refreshToken(
    @Body('refreshToken') refreshToken: string,
    @Body('shopId') shopId: string,
  ) {
    return this.shopeeService.refreshToken(refreshToken, shopId);
  }
}
