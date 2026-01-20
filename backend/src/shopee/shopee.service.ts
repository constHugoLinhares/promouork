import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ShopeeService {
  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}

  /**
   * Creates a signature for Shopee API
   * @param {string} partnerId - Partner ID
   * @param {string} partnerKey - Partner Key
   * @param {string} path - API path
   * @param {Object} params - Request parameters
   * @returns {Object} - Object containing sign and timestamp
   */
  createSignature(
    partnerId: string,
    partnerKey: string,
    path: string,
    params: Record<string, any> = {},
  ) {
    const timestamp = Math.floor(Date.now() / 1000);

    // Base string for signature: partner_id + path + timestamp + access_token (if exists) + shop_id (if exists)
    const baseString = `${partnerId}${path}${timestamp}${params.access_token || ''}${params.shop_id || ''}`;

    // Create HMAC SHA256 signature
    const sign = crypto
      .createHmac('sha256', partnerKey)
      .update(baseString)
      .digest('hex');

    return { sign, timestamp };
  }

  /**
   * Generates the OAuth authorization URL for Shopee
   * This URL should be used to redirect the user to Shopee authorization page
   * @param {string} redirectUri - The callback URL registered in Shopee Partner Center
   * @returns {Object} - Object containing the authorization URL and state
   */
  generateAuthorizationUrl(redirectUri?: string): {
    url: string;
    state: string;
  } {
    const partnerId = this.configService.get<string>('SHOPEE_PARTNER_ID');
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const defaultRedirectUri = this.configService.get<string>(
      'SHOPEE_REDIRECT_URI',
      `${frontendUrl}/integrations/callback`,
    );

    if (!partnerId) {
      throw new Error(
        'SHOPEE_PARTNER_ID must be provided as an environment variable',
      );
    }

    const state = crypto.randomUUID();
    const params = new URLSearchParams({
      partner_id: partnerId,
      redirect: redirectUri || defaultRedirectUri,
      state,
    });

    // Shopee authorization URL (adjust based on actual API documentation)
    const url = `https://partner.shopeemobile.com/api/v2/shop/auth_partner?${params.toString()}`;

    return { url, state };
  }

  /**
   * Exchanges authorization code for access token
   * @param {string} code - Authorization code received from OAuth callback
   * @param {string} shopId - Shop ID from the callback
   * @param {string} redirectUri - The redirect URI used in the authorization request
   * @returns {Promise<Object>} - API response with access_token and refresh_token
   */
  async exchangeCodeForToken(
    code: string,
    shopId: string,
    redirectUri?: string,
  ): Promise<any> {
    const partnerId = this.configService.get<string>('SHOPEE_PARTNER_ID');
    const partnerKey = this.configService.get<string>('SHOPEE_PARTNER_KEY');
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const defaultRedirectUri = this.configService.get<string>(
      'SHOPEE_REDIRECT_URI',
      `${frontendUrl}/integrations/callback`,
    );

    if (!partnerId || !partnerKey) {
      throw new Error(
        'SHOPEE_PARTNER_ID and SHOPEE_PARTNER_KEY must be provided as environment variables',
      );
    }

    const finalRedirectUri = redirectUri || defaultRedirectUri;

    try {
      const path = '/api/v2/auth/token/get';
      const { sign, timestamp } = this.createSignature(
        partnerId,
        partnerKey,
        path,
        { shop_id: shopId },
      );

      const response = await firstValueFrom(
        this.httpService.post<{
          access_token: string;
          refresh_token: string;
          expire_in: number;
        }>(
          `https://partner.shopeemobile.com${path}`,
          {
            partner_id: partnerId,
            code,
            shop_id: shopId,
            redirect: finalRedirectUri,
            timestamp,
            sign,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(
          `Shopee API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
        );
      }
      throw error;
    }
  }

  /**
   * Refreshes the access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @param {string} shopId - Shop ID
   * @returns {Promise<Object>} - API response with new access_token and refresh_token
   */
  async refreshToken(refreshToken: string, shopId: string): Promise<any> {
    const partnerId = this.configService.get<string>('SHOPEE_PARTNER_ID');
    const partnerKey = this.configService.get<string>('SHOPEE_PARTNER_KEY');

    if (!partnerId || !partnerKey) {
      throw new Error(
        'SHOPEE_PARTNER_ID and SHOPEE_PARTNER_KEY must be provided as environment variables',
      );
    }

    try {
      const path = '/api/v2/auth/access_token/get';
      const { sign, timestamp } = this.createSignature(
        partnerId,
        partnerKey,
        path,
        { shop_id: shopId },
      );

      const response = await firstValueFrom(
        this.httpService.post<{
          access_token: string;
          refresh_token: string;
          expire_in: number;
        }>(
          `https://partner.shopeemobile.com${path}`,
          {
            partner_id: partnerId,
            refresh_token: refreshToken,
            shop_id: shopId,
            timestamp,
            sign,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(
          `Shopee API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
        );
      }
      throw error;
    }
  }
}
