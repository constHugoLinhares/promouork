import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ShopeeCacheService } from '../shopee/shopee-cache.service';
import { CreateIntegrationChannelConfigDto } from './dto/create-integration-channel-config.dto';
import { UpdateIntegrationChannelConfigDto } from './dto/update-integration-channel-config.dto';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly shopeeCacheService: ShopeeCacheService,
  ) {}

  /**
   * GET /integrations
   * Lista todas as integrações disponíveis
   * As integrações são fixas e não podem ser editadas/deletadas pelo usuário
   */
  @Get()
  findAll() {
    return this.integrationsService.findAll();
  }

  /**
   * DELETE /integrations/:id/cache
   * Limpa o cache de uma integração específica
   * IMPORTANTE: Este endpoint deve vir antes de @Get(':id') para evitar conflito de rotas
   */
  @Delete(':id/cache')
  async clearCache(@Param('id') id: string) {
    const integration = await this.integrationsService.findOne(id);
    
    if (!integration) {
      throw new Error('Integration not found');
    }

    // Por enquanto, apenas Shopee tem cache
    // Outras integrações podem ser implementadas no futuro
    if (integration.type === 'shopee') {
      const deletedCount = await this.shopeeCacheService.clearAllCache();
      return {
        message: `Cache da integração ${integration.name} limpo com sucesso`,
        deletedKeys: deletedCount,
      };
    }

    return {
      message: `A integração ${integration.name} não possui cache para limpar`,
      deletedKeys: 0,
    };
  }

  /**
   * GET /integrations/:id
   * Busca uma integração específica por ID
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.integrationsService.findOne(id);
  }

  /**
   * GET /integrations/type/:type
   * Busca uma integração por tipo (ex: 'aliexpress', 'shopee')
   */
  @Get('type/:type')
  findByType(@Param('type') type: string) {
    return this.integrationsService.findByType(type);
  }

  /**
   * POST /integrations/:integrationId/channels/:channelId
   * Adiciona um canal a uma integração
   */
  @Post(':integrationId/channels/:channelId')
  addChannelToIntegration(
    @Param('integrationId') integrationId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.integrationsService.addChannelToIntegration(
      integrationId,
      channelId,
    );
  }

  /**
   * DELETE /integrations/:integrationId/channels/:channelId
   * Remove um canal de uma integração
   */
  @Delete(':integrationId/channels/:channelId')
  removeChannelFromIntegration(
    @Param('integrationId') integrationId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.integrationsService.removeChannelFromIntegration(
      integrationId,
      channelId,
    );
  }

  /**
   * GET /integrations/:integrationId/channels
   * Busca todos os canais relacionados a uma integração
   */
  @Get(':integrationId/channels')
  findChannelsByIntegration(@Param('integrationId') integrationId: string) {
    return this.integrationsService.findChannelsByIntegration(integrationId);
  }

  /**
   * GET /channels/:channelId/integrations
   * Busca todas as integrações relacionadas a um canal
   */
  @Get('channels/:channelId/integrations')
  findIntegrationsByChannel(@Param('channelId') channelId: string) {
    return this.integrationsService.findIntegrationsByChannel(channelId);
  }

  /**
   * POST /integrations/:integrationId/channels/:channelId/config
   * Cria ou atualiza configuração específica de uma integração para um canal
   * Ex: Para Shopee, config pode ser { keywords: ["bola de basquete", "tênis nike"] }
   */
  @Post(':integrationId/channels/:channelId/config')
  upsertIntegrationChannelConfig(
    @Param('integrationId') integrationId: string,
    @Param('channelId') channelId: string,
    @Body()
    config: Omit<
      CreateIntegrationChannelConfigDto,
      'integrationId' | 'channelId'
    >,
  ) {
    return this.integrationsService.upsertIntegrationChannelConfig({
      ...config,
      integrationId,
      channelId,
    });
  }

  /**
   * GET /integrations/:integrationId/channels/:channelId/config
   * Busca configuração específica de uma integração para um canal
   */
  @Get(':integrationId/channels/:channelId/config')
  findIntegrationChannelConfig(
    @Param('integrationId') integrationId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.integrationsService.findIntegrationChannelConfig(
      integrationId,
      channelId,
    );
  }

  /**
   * PATCH /integrations/configs/:id
   * Atualiza configuração específica de uma integração para um canal
   */
  @Patch('configs/:id')
  updateIntegrationChannelConfig(
    @Param('id') id: string,
    @Body() updateConfigDto: UpdateIntegrationChannelConfigDto,
  ) {
    return this.integrationsService.updateIntegrationChannelConfig(
      id,
      updateConfigDto,
    );
  }

  /**
   * DELETE /integrations/configs/:id
   * Remove configuração específica de uma integração para um canal
   */
  @Delete('configs/:id')
  removeIntegrationChannelConfig(@Param('id') id: string) {
    return this.integrationsService.removeIntegrationChannelConfig(id);
  }

  /**
   * GET /integrations/:integrationId/channel-configs
   * Busca todas as configurações de canais para uma integração
   */
  @Get(':integrationId/channel-configs')
  findChannelConfigsByIntegration(
    @Param('integrationId') integrationId: string,
  ) {
    return this.integrationsService.findChannelConfigsByIntegration(
      integrationId,
    );
  }

  /**
   * GET /channels/:channelId/integration-configs
   * Busca todas as configurações de integrações para um canal
   */
  @Get('channels/:channelId/integration-configs')
  findIntegrationConfigsByChannel(@Param('channelId') channelId: string) {
    return this.integrationsService.findIntegrationConfigsByChannel(channelId);
  }

  /**
   * PATCH /integrations/:id/credentials
   * Atualiza as credenciais de uma integração
   * Para Shopee: { partnerId: string, partnerKey: string }
   */
  @Patch(':id/credentials')
  updateCredentials(
    @Param('id') id: string,
    @Body() credentials: Record<string, any>,
  ) {
    return this.integrationsService.updateCredentials(id, credentials);
  }
}
