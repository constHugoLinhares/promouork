import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { randomBytes } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { IntegrationsService } from '../integrations/integrations.service';

const EVOLUTION_UNAVAILABLE =
  'Evolution API indisponível. Verifique se o serviço está rodando (EVOLUTION_API_URL).';

/** Thrown when Evolution API returns 404 - instance no longer exists on the server. */
export class EvolutionInstanceNotFoundError extends Error {
  constructor(instanceName: string) {
    super(`Evolution instance not found: ${instanceName}`);
    this.name = 'EvolutionInstanceNotFoundError';
  }
}

export interface EvolutionCredentials {
  instanceName: string;
  apikey: string;
}

export interface EvolutionConnectionState {
  state: string;
  hasInstance: boolean;
}

export interface EvolutionConnectResult {
  qrCode: string | null;
  instanceName: string;
  pairCode?: string;
}

export interface EvolutionChatItem {
  id: string;
  name?: string;
  type: 'chat' | 'group' | 'channel';
}

@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);
  private readonly baseUrl: string;
  private readonly globalApikey: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly integrationsService: IntegrationsService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'EVOLUTION_API_URL',
      'http://localhost:8081',
    );
    this.globalApikey = this.configService.get<string>('EVOLUTION_API_KEY');
  }

  private getHeaders(instanceApikey?: string): Record<string, string> {
    const apikey = instanceApikey ?? this.globalApikey;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apikey) {
      headers['apikey'] = apikey;
    }
    return headers;
  }

  /**
   * Get Evolution integration credentials from DB (instanceName + apikey).
   */
  async getCredentials(): Promise<EvolutionCredentials | null> {
    const integration = await this.integrationsService.findByType('evolution');
    if (
      !integration?.credentials ||
      typeof integration.credentials !== 'object'
    ) {
      return null;
    }
    const creds = integration.credentials as Record<string, unknown>;
    const instanceName = creds.instanceName as string | undefined;
    const apikey = creds.apikey as string | undefined;
    if (!instanceName || !apikey) {
      return null;
    }
    return { instanceName, apikey };
  }

  /**
   * Persist Evolution credentials for the integration.
   */
  async setCredentials(credentials: EvolutionCredentials): Promise<void> {
    const integration = await this.integrationsService.findByType('evolution');
    if (!integration) {
      throw new Error(
        'Evolution integration not found. Run seed to create it.',
      );
    }
    await this.integrationsService.updateCredentials(
      integration.id,
      credentials,
    );
  }

  /**
   * Clear Evolution credentials from the integration (after instance is deleted).
   */
  async clearCredentials(): Promise<void> {
    const integration = await this.integrationsService.findByType('evolution');
    if (!integration) return;
    await this.integrationsService.updateCredentials(integration.id, {});
  }

  private isAxiosNetworkError(err: unknown): boolean {
    return (
      err instanceof Error &&
      (err as AxiosError).isAxiosError === true &&
      ((err as AxiosError).code === 'ECONNREFUSED' ||
        (err as AxiosError).code === 'ECONNRESET' ||
        (err as AxiosError).code === 'ETIMEDOUT' ||
        (err as AxiosError).code === 'ENOTFOUND')
    );
  }

  /**
   * Create instance in Evolution API. Returns instanceName and apikey (token).
   * If the API does not return an apikey, we use our own generated token.
   */
  async createInstance(
    instanceName?: string,
    token?: string,
  ): Promise<EvolutionCredentials> {
    const name = instanceName ?? `promouork_${Date.now()}`;
    const instanceToken = token ?? randomBytes(32).toString('hex');
    const body: Record<string, unknown> = {
      instanceName: name,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
      token: instanceToken,
    };
    const url = `${this.baseUrl.replace(/\/$/, '')}/instance/create`;
    let response;
    try {
      response = await firstValueFrom(
        this.httpService.post(url, body, {
          headers: this.getHeaders(),
          validateStatus: () => true,
        }),
      );
    } catch (err) {
      if (this.isAxiosNetworkError(err)) {
        throw new ServiceUnavailableException(EVOLUTION_UNAVAILABLE);
      }
      throw err;
    }
    if (response.status === 401) {
      throw new BadGatewayException(
        'Evolution API retornou Não autorizado. Configure EVOLUTION_API_KEY no .env do backend com o mesmo valor de AUTHENTICATION_API_KEY do container Evolution API (no docker-compose.evolution.yml use EVOLUTION_API_KEY ou AUTHENTICATION_API_KEY).',
      );
    }
    if (response.status === 400) {
      const detail =
        response.data?.message ??
        response.data?.error ??
        (typeof response.data === 'object'
          ? JSON.stringify(response.data)
          : String(response.data));
      throw new BadGatewayException(
        `Evolution API rejeitou a requisição (Bad Request): ${detail}`,
      );
    }
    if (response.status !== 200 && response.status !== 201) {
      const msg =
        response.data?.message ??
        response.data?.error ??
        JSON.stringify(response.data);
      throw new Error(`Evolution create instance failed: ${msg}`);
    }
    const data = response.data ?? {};
    const returnedName = (data.instance?.instanceName ??
      data.instanceName ??
      name) as string;
    const apikey =
      ((data.instance?.apikey ?? data.apikey ?? data.token) as
        | string
        | undefined) ?? instanceToken;
    return { instanceName: returnedName, apikey };
  }

  /**
   * Get QR code (or pair code) for instance connect. Returns base64 image or pairCode.
   */
  async getConnectQr(
    instanceName: string,
    apikey: string,
  ): Promise<EvolutionConnectResult> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/instance/connect/${instanceName}`;
    let response;
    try {
      response = await firstValueFrom(
        this.httpService.get(url, {
          headers: this.getHeaders(apikey),
          validateStatus: () => true,
        }),
      );
    } catch (err) {
      if (this.isAxiosNetworkError(err)) {
        throw new ServiceUnavailableException(EVOLUTION_UNAVAILABLE);
      }
      throw err;
    }
    if (response.status === 404) {
      throw new EvolutionInstanceNotFoundError(instanceName);
    }
    if (response.status !== 200) {
      const msg =
        response.data?.message ??
        response.data?.error ??
        JSON.stringify(response.data);
      throw new Error(`Evolution get QR failed: ${msg}`);
    }
    const data = response.data ?? {};
    const base64 = (data.base64 ?? data.qrcode?.base64) as string | undefined;
    const pairCode = (data.pairCode ?? data.code) as string | undefined;
    return {
      qrCode: base64 ?? (pairCode ? null : null),
      instanceName,
      pairCode,
    };
  }

  /**
   * Get connection state: open, close, connecting.
   */
  async getConnectionState(
    instanceName: string,
    apikey: string,
  ): Promise<string> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/instance/connectionState/${instanceName}`;
    let response;
    try {
      response = await firstValueFrom(
        this.httpService.get(url, {
          headers: this.getHeaders(apikey),
          validateStatus: () => true,
        }),
      );
    } catch (err) {
      if (this.isAxiosNetworkError(err)) {
        throw new ServiceUnavailableException(EVOLUTION_UNAVAILABLE);
      }
      throw err;
    }
    if (response.status !== 200) {
      return 'close';
    }
    const data = response.data ?? {};
    const state = (data.state ?? data.instance?.state ?? 'close') as string;
    return state;
  }

  /**
   * Fetch chats from instance (conversations, groups, channels).
   * Uses Evolution API POST /chat/findChats/{instanceName}.
   */
  async fetchChats(
    instanceName: string,
    apikey: string,
  ): Promise<EvolutionChatItem[]> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/group/fetchAllGroups/${instanceName}?getParticipants=false`;

    let response;
    try {
      response = await firstValueFrom(
        this.httpService.get(url, {
          headers: this.getHeaders(apikey),
          validateStatus: () => true,
        }),
      );
    } catch (err) {
      if (this.isAxiosNetworkError(err)) {
        throw new ServiceUnavailableException(EVOLUTION_UNAVAILABLE);
      }
      throw err;
    }
    if (response.status === 401) {
      throw new BadGatewayException(
        'Evolution API retornou Não autorizado. Verifique EVOLUTION_API_KEY no .env (mesmo valor de AUTHENTICATION_API_KEY do container Evolution).',
      );
    }
    if (response.status !== 200) {
      const msg =
        response.data?.message ??
        response.data?.error ??
        JSON.stringify(response.data);
      throw new Error(`Evolution fetchAllGroups failed: ${msg}`);
    }
    const data = response.data ?? {};
    return this.normalizeChatsResponse(data);
  }

  private normalizeChatsResponse(
    data: Record<string, unknown>,
  ): EvolutionChatItem[] {
    const items: EvolutionChatItem[] = [];
    // Format: array of { id, remoteJid, name, pushName, ... }
    const arr = Array.isArray(data)
      ? data
      : (data.chats as unknown[] | undefined);
    if (Array.isArray(arr) && arr.length > 0) {
      for (const row of arr) {
        const obj = row as Record<string, unknown>;
        const id = (obj.remoteJid as string) ?? (obj.id as string);
        if (!id) continue;
        const name =
          (obj.pushName as string | undefined) ??
          (obj.subject as string | undefined);
        let type: 'chat' | 'group' | 'channel' = 'chat';
        if (String(id).endsWith('@g.us')) type = 'group';
        else if (
          String(id).includes('newsletter') ||
          String(id).endsWith('@newsletter')
        )
          type = 'channel';
        items.push({ id, name, type });
      }
      return items;
    }
    // Format: { singleChats: string[], groupChats: string[] }
    const singleChats = (data.singleChats as string[] | undefined) ?? [];
    const groupChats = (data.groupChats as string[] | undefined) ?? [];
    for (const id of singleChats) {
      const fullId = id.includes('@') ? id : `${id}@s.whatsapp.net`;
      items.push({
        id: fullId,
        type: fullId.includes('newsletter') ? 'channel' : 'chat',
      });
    }
    for (const id of groupChats) {
      items.push({
        id: id.includes('@') ? id : `${id}@g.us`,
        type: 'group',
      });
    }
    return items;
  }

  /**
   * Logout (disconnect) instance from WhatsApp.
   */
  async logout(instanceName: string, apikey: string): Promise<void> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/instance/logout/${instanceName}`;
    let response;
    try {
      response = await firstValueFrom(
        this.httpService.delete(url, {
          headers: this.getHeaders(apikey),
          validateStatus: () => true,
        }),
      );
    } catch (err) {
      if (this.isAxiosNetworkError(err)) {
        throw new ServiceUnavailableException(EVOLUTION_UNAVAILABLE);
      }
      throw err;
    }
    if (response.status !== 200 && response.status !== 204) {
      const msg =
        response.data?.message ??
        response.data?.error ??
        JSON.stringify(response.data);
      throw new Error(`Evolution logout failed: ${msg}`);
    }
  }

  /**
   * Delete instance from Evolution API and clear stored credentials.
   * Used when user disconnects; next connect will create a new instance.
   */
  async deleteInstanceAndClearCredentials(): Promise<void> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      await this.clearCredentials();
      return;
    }
    const url = `${this.baseUrl.replace(/\/$/, '')}/instance/delete/${credentials.instanceName}`;
    try {
      const response = await firstValueFrom(
        this.httpService.delete(url, {
          headers: this.getHeaders(credentials.apikey),
          validateStatus: () => true,
        }),
      );
      if (response.status >= 200 && response.status < 300) {
        this.logger.log(
          `Evolution instance deleted: ${credentials.instanceName}`,
        );
      } else {
        const msg =
          response.data?.message ??
          response.data?.error ??
          JSON.stringify(response.data);
        this.logger.warn(
          `Evolution delete instance returned ${response.status}: ${msg}`,
        );
      }
    } catch (err) {
      if (this.isAxiosNetworkError(err)) {
        this.logger.warn(
          'Evolution API unreachable when deleting instance; clearing credentials anyway.',
        );
      } else {
        throw err;
      }
    }
    await this.clearCredentials();
  }

  /**
   * Send text and optionally media via Evolution API.
   * number: phone with country code (e.g. 5511999999999), no +.
   */
  async sendMessage(
    number: string,
    text: string,
    imageUrl?: string,
  ): Promise<{ sent: boolean }> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      throw new Error(
        'Evolution credentials not configured. Connect WhatsApp in Integrations.',
      );
    }
    const normalizedNumber = number.replace(/\D/g, '');
    if (imageUrl) {
      const mediaUrl = `${this.baseUrl.replace(/\/$/, '')}/message/sendMedia/${credentials.instanceName}`;
      const response = await firstValueFrom(
        this.httpService.post(
          mediaUrl,
          {
            number: normalizedNumber,
            mediatype: 'image',
            media: imageUrl,
            caption: text,
          },
          {
            headers: this.getHeaders(credentials.apikey),
            validateStatus: () => true,
          },
        ),
      );
      if (response.status !== 200 && response.status !== 201) {
        const msg =
          response.data?.message ??
          response.data?.error ??
          JSON.stringify(response.data);
        throw new Error(`Evolution send media failed: ${msg}`);
      }
    } else {
      const textUrl = `${this.baseUrl.replace(/\/$/, '')}/message/sendText/${credentials.instanceName}`;
      const response = await firstValueFrom(
        this.httpService.post(
          textUrl,
          {
            number: normalizedNumber,
            text,
          },
          {
            headers: this.getHeaders(credentials.apikey),
            validateStatus: () => true,
          },
        ),
      );
      if (response.status !== 200 && response.status !== 201) {
        const msg =
          response.data?.message ??
          response.data?.error ??
          JSON.stringify(response.data);
        throw new Error(`Evolution send text failed: ${msg}`);
      }
    }
    return { sent: true };
  }
}
