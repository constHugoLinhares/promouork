import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

@Injectable()
export class ChannelsService {
  constructor(private prisma: PrismaService) {}

  async create(createChannelDto: CreateChannelDto) {
    return this.prisma.channel.create({
      data: createChannelDto,
      include: {
        category: {
          include: {
            subcategories: true,
          },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.channel.findMany({
      include: {
        category: {
          include: {
            subcategories: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.channel.findUnique({
      where: { id },
      include: {
        category: {
          include: {
            subcategories: true,
          },
        },
        posts: {
          include: {
            post: true,
          },
        },
        products: {
          include: {
            category: true,
            subcategory: true,
            copyMessages: {
              include: {
                copyMessage: true,
              },
            },
          },
        },
      },
    });
  }

  async update(id: string, updateChannelDto: UpdateChannelDto) {
    return this.prisma.channel.update({
      where: { id },
      data: updateChannelDto,
      include: {
        category: {
          include: {
            subcategories: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    return await this.prisma.channel.delete({
      where: { id },
    });
  }
}
