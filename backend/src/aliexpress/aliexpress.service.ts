import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AliexpressService {
  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}

  /**
   * Creates a signature for AliExpress API
   * Supports both System Interfaces and Business Interfaces
   * @param {string} appKey - Application key
   * @param {string} appSecret - Application secret
   * @param {string} endpoint - API endpoint (e.g., "/auth/token/create" for System or "aliexpress.solution.product.schema.get" for Business)
   * @param {Object} additionalParams - Additional parameters to include in signature
   * @param {string} type - "system" or "business" (default: "system")
   * @returns {Object} - Object containing sign, timestamp, and params
   */
  createSignature(
    appKey: string,
    appSecret: string,
    endpoint: string,
    additionalParams: Record<string, any> = {},
    type: 'system' | 'business' = 'system',
  ) {
    // Timestamp in milliseconds (as required by AliExpress API)
    const timestamp = Date.now().toString();

    const params = {
      app_key: appKey,
      sign_method: 'sha256',
      timestamp,
      ...additionalParams,
    };

    // Sort parameters and create string to sign
    const sorted = Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join('');

    // For System Interfaces: add endpoint BEFORE the sorted parameters
    // For Business Interfaces: only use sorted parameters (no endpoint prefix)
    const strToSign = type === 'system' ? endpoint + sorted : sorted;

    // Create HMAC SHA256 signature
    const sign = crypto
      .createHmac('sha256', appSecret)
      .update(strToSign)
      .digest('hex')
      .toUpperCase();

    return { sign, timestamp, params };
  }

  /**
   * Generates the OAuth authorization URL for AliExpress
   * This URL should be used to redirect the user to AliExpress authorization page
   * @param {string} redirectUri - The callback URL registered in AliExpress Open Platform
   * @returns {Object} - Object containing the authorization URL and state
   */
  generateAuthorizationUrl(redirectUri?: string): {
    url: string;
    state: string;
  } {
    const appKey = this.configService.get<string>('ALI_APP_KEY');
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const defaultRedirectUri = this.configService.get<string>(
      'ALI_REDIRECT_URI',
      `${frontendUrl}/integrations/callback`,
    );

    if (!appKey) {
      throw new Error(
        'ALI_APP_KEY must be provided as an environment variable',
      );
    }

    const state = crypto.randomUUID();
    const params = new URLSearchParams({
      client_id: appKey,
      response_type: 'code',
      redirect_uri: redirectUri || defaultRedirectUri,
      state,
    });

    const url = `https://auth.aliexpress.com/oauth/authorize?${params.toString()}`;

    return { url, state };
  }

  /**
   * Exchanges authorization code for access token
   * @param {string} code - Authorization code received from OAuth callback
   * @param {string} redirectUri - The redirect URI used in the authorization request
   * @returns {Promise<Object>} - API response with access_token and refresh_token
   */
  async exchangeCodeForToken(code: string, redirectUri?: string): Promise<any> {
    const appKey = this.configService.get<string>('ALI_APP_KEY');
    const appSecret = this.configService.get<string>('ALI_APP_SECRET');
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const defaultRedirectUri = this.configService.get<string>(
      'ALI_REDIRECT_URI',
      `${frontendUrl}/integrations/callback`,
    );

    if (!appKey || !appSecret) {
      throw new Error(
        'ALI_APP_KEY and ALI_APP_SECRET must be provided as environment variables',
      );
    }

    const finalRedirectUri = redirectUri || defaultRedirectUri;

    try {
      const response = await firstValueFrom(
        this.httpService.post<{
          access_token: string;
          refresh_token: string;
          expires_in: number;
        }>(
          'https://auth-sg.aliexpress.com/rest/auth/token/create',
          new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: appKey,
            client_secret: appSecret,
            redirect_uri: finalRedirectUri,
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(
          `AliExpress API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
        );
      }
      throw error;
    }
  }
}
