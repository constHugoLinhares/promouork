import {
  Controller,
  Delete,
  Get,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  EvolutionChatItem,
  EvolutionConnectResult,
  EvolutionConnectionState,
  EvolutionService,
} from './evolution.service';

@Controller('evolution')
export class EvolutionController {
  private readonly logger = new Logger(EvolutionController.name);

  constructor(private readonly evolutionService: EvolutionService) {}

  /**
   * GET /evolution/status
   * Returns connection state and whether an instance exists.
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(): Promise<EvolutionConnectionState> {
    const credentials = await this.evolutionService.getCredentials();
    if (!credentials) {
      return { state: 'close', hasInstance: false };
    }
    const state = await this.evolutionService.getConnectionState(
      credentials.instanceName,
      credentials.apikey,
    );
    return { state, hasInstance: true };
  }

  /**
   * POST /evolution/connect
   * Creates instance if needed, persists credentials, returns QR for frontend.
   */
  @Post('connect')
  @UseGuards(JwtAuthGuard)
  async connect(): Promise<EvolutionConnectResult> {
    let credentials = await this.evolutionService.getCredentials();
    if (!credentials) {
      credentials = await this.evolutionService.createInstance();
      await this.evolutionService.setCredentials(credentials);
    }
    const result = await this.evolutionService.getConnectQr(
      credentials.instanceName,
      credentials.apikey,
    );
    return result;
  }

  /**
   * GET /evolution/qr
   * Returns current QR (for polling). Use when already have instance.
   */
  @Get('qr')
  @UseGuards(JwtAuthGuard)
  async getQr(): Promise<{ qrCode: string | null; pairCode?: string }> {
    const credentials = await this.evolutionService.getCredentials();
    if (!credentials) {
      throw new Error(
        'No Evolution instance. Call POST /evolution/connect first.',
      );
    }
    const result = await this.evolutionService.getConnectQr(
      credentials.instanceName,
      credentials.apikey,
    );
    return { qrCode: result.qrCode, pairCode: result.pairCode };
  }

  /**
   * GET /evolution/chats
   * Returns list of chats (conversations, groups, channels) for the instance.
   */
  @Get('chats')
  @UseGuards(JwtAuthGuard)
  async getChats(): Promise<{ chats: EvolutionChatItem[] }> {
    const credentials = await this.evolutionService.getCredentials();
    if (!credentials) {
      return { chats: [] };
    }
    const state = await this.evolutionService.getConnectionState(
      credentials.instanceName,
      credentials.apikey,
    );
    if (state !== 'open') {
      return { chats: [] };
    }
    const chats = await this.evolutionService.fetchChats(
      credentials.instanceName,
      credentials.apikey,
    );
    return { chats };
  }

  /**
   * DELETE /evolution/logout
   * Disconnects and deletes the Evolution instance, then clears credentials.
   * Next connect will create a new instance and require a new QR code.
   */
  @Delete('logout')
  @UseGuards(JwtAuthGuard)
  async logout(): Promise<{ message: string }> {
    await this.evolutionService.deleteInstanceAndClearCredentials();
    return { message: 'Desconectado com sucesso' };
  }
}
