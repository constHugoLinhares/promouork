import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIntegrationChannelConfigDto } from './dto/create-integration-channel-config.dto';
import { UpdateIntegrationChannelConfigDto } from './dto/update-integration-channel-config.dto';

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lista todas as integrações disponíveis
   * As integrações são fixas e não podem ser editadas/deletadas pelo usuário
   */
  async findAll() {
    return this.prisma.integration.findMany({
      include: {
        channels: {
          include: {
            category: {
              include: {
                subcategories: true,
              },
            },
          },
        },
        channelConfigs: {
          include: {
            channel: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Busca uma integração específica por ID
   */
  async findOne(id: string) {
    return this.prisma.integration.findUnique({
      where: { id },
      include: {
        channels: {
          include: {
            category: {
              include: {
                subcategories: true,
              },
            },
          },
        },
        channelConfigs: {
          include: {
            channel: true,
          },
        },
      },
    });
  }

  /**
   * Busca uma integração por tipo (ex: 'aliexpress', 'shopee')
   */
  async findByType(type: string) {
    return this.prisma.integration.findUnique({
      where: { type },
      include: {
        channels: {
          include: {
            category: {
              include: {
                subcategories: true,
              },
            },
          },
        },
        channelConfigs: {
          include: {
            channel: true,
          },
        },
      },
    });
  }

  /**
   * Adiciona um canal a uma integração
   */
  async addChannelToIntegration(integrationId: string, channelId: string) {
    return this.prisma.integration.update({
      where: { id: integrationId },
      data: {
        channels: {
          connect: { id: channelId },
        },
      },
      include: {
        channels: {
          include: {
            category: {
              include: {
                subcategories: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Remove um canal de uma integração
   */
  async removeChannelFromIntegration(integrationId: string, channelId: string) {
    return this.prisma.integration.update({
      where: { id: integrationId },
      data: {
        channels: {
          disconnect: { id: channelId },
        },
      },
      include: {
        channels: {
          include: {
            category: {
              include: {
                subcategories: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Busca todos os canais relacionados a uma integração
   */
  async findChannelsByIntegration(integrationId: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
      include: {
        channels: {
          include: {
            category: {
              include: {
                subcategories: true,
              },
            },
          },
        },
      },
    });
    return integration?.channels || [];
  }

  /**
   * Busca todas as integrações relacionadas a um canal
   */
  async findIntegrationsByChannel(channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        integrations: true,
        category: {
          include: {
            subcategories: true,
          },
        },
      },
    });
    return channel?.integrations || [];
  }

  /**
   * Cria ou atualiza configuração específica de uma integração para um canal
   * Ex: Para Shopee, pode conter { keywords: ["bola de basquete", "tênis nike"] }
   */
  async upsertIntegrationChannelConfig(
    createConfigDto: CreateIntegrationChannelConfigDto,
  ) {
    return this.prisma.integrationChannelConfig.upsert({
      where: {
        integrationId_channelId: {
          integrationId: createConfigDto.integrationId,
          channelId: createConfigDto.channelId,
        },
      },
      update: {
        config: createConfigDto.config,
        isActive: createConfigDto.isActive,
      },
      create: createConfigDto,
      include: {
        integration: true,
        channel: {
          include: {
            category: {
              include: {
                subcategories: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Busca configuração específica de uma integração para um canal
   */
  async findIntegrationChannelConfig(integrationId: string, channelId: string) {
    return this.prisma.integrationChannelConfig.findUnique({
      where: {
        integrationId_channelId: {
          integrationId,
          channelId,
        },
      },
      include: {
        integration: true,
        channel: {
          include: {
            category: {
              include: {
                subcategories: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Atualiza configuração específica de uma integração para um canal
   */
  async updateIntegrationChannelConfig(
    id: string,
    updateConfigDto: UpdateIntegrationChannelConfigDto,
  ) {
    return this.prisma.integrationChannelConfig.update({
      where: { id },
      data: updateConfigDto,
      include: {
        integration: true,
        channel: {
          include: {
            category: {
              include: {
                subcategories: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Remove configuração específica de uma integração para um canal
   */
  async removeIntegrationChannelConfig(id: string) {
    return this.prisma.integrationChannelConfig.delete({
      where: { id },
    });
  }

  /**
   * Busca todas as configurações de canais para uma integração
   */
  async findChannelConfigsByIntegration(integrationId: string) {
    return this.prisma.integrationChannelConfig.findMany({
      where: { integrationId },
      include: {
        channel: {
          include: {
            category: {
              include: {
                subcategories: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Busca todas as configurações de integrações para um canal
   */
  async findIntegrationConfigsByChannel(channelId: string) {
    return this.prisma.integrationChannelConfig.findMany({
      where: { channelId },
      include: {
        integration: true,
      },
    });
  }

  /**
   * Atualiza as credenciais de uma integração
   * Para Shopee: { partnerId: string, partnerKey: string }
   */
  async updateCredentials(id: string, credentials: Record<string, any>) {
    return this.prisma.integration.update({
      where: { id },
      data: {
        credentials,
      },
      include: {
        channels: {
          include: {
            category: {
              include: {
                subcategories: true,
              },
            },
          },
        },
        channelConfigs: {
          include: {
            channel: true,
          },
        },
      },
    });
  }
}
