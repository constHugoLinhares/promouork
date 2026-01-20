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
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchedulerDto } from './dto/create-scheduler.dto';
import { UpdateSchedulerDto } from './dto/update-scheduler.dto';
import { SchedulerService } from './scheduler.service';

@Controller('schedulers')
@UseGuards(JwtAuthGuard)
export class SchedulersController {
  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(@Body() createSchedulerDto: CreateSchedulerDto) {
    const { channelIds, config, integrationId, ...schedulerData } =
      createSchedulerDto;

    // Validar que a integração existe e está ativa
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || !integration.isActive) {
      throw new Error('Integration not found or inactive');
    }

    // Validar que todos os canais existem
    const channels = await this.prisma.channel.findMany({
      where: {
        id: { in: channelIds },
      },
    });

    if (channels.length !== channelIds.length) {
      throw new Error('One or more channels not found');
    }

    // Criar scheduler
    const scheduler = await this.prisma.postScheduler.create({
      data: {
        ...schedulerData,
        config: config || {},
        integration: {
          connect: { id: integrationId },
        },
        channels: {
          create: channelIds.map((channelId) => ({
            channelId,
          })),
        },
      },
      include: {
        integration: true,
        channels: {
          include: {
            channel: true,
          },
        },
      },
    });

    // Calcular próxima execução
    const nextRunAt = new Date(
      Date.now() + scheduler.intervalMinutes * 60 * 1000,
    );

    await this.prisma.postScheduler.update({
      where: { id: scheduler.id },
      data: { nextRunAt },
    });

    return scheduler;
  }

  @Get()
  async findAll() {
    return this.prisma.postScheduler.findMany({
      include: {
        integration: true,
        channels: {
          include: {
            channel: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.prisma.postScheduler.findUnique({
      where: { id },
      include: {
        integration: true,
        channels: {
          include: {
            channel: true,
          },
        },
      },
    });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateSchedulerDto: UpdateSchedulerDto,
  ) {
    const { channelIds, ...updateData } = updateSchedulerDto;

    // Se channelIds foi fornecido, atualizar canais
    if (channelIds !== undefined) {
      // Remover canais existentes
      await this.prisma.postSchedulerChannel.deleteMany({
        where: { schedulerId: id },
      });

      // Adicionar novos canais
      if (channelIds.length > 0) {
        await this.prisma.postSchedulerChannel.createMany({
          data: channelIds.map((channelId) => ({
            schedulerId: id,
            channelId,
          })),
        });
      }
    }

    return this.prisma.postScheduler.update({
      where: { id },
      data: updateData,
      include: {
        integration: true,
        channels: {
          include: {
            channel: true,
          },
        },
      },
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.prisma.postScheduler.delete({
      where: { id },
    });
  }

  @Post(':id/execute')
  async execute(@Param('id') id: string) {
    await this.schedulerService.executeScheduler(id);
    return { message: 'Scheduler executed successfully' };
  }
}
