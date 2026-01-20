import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  async create(createTemplateDto: CreateTemplateDto) {
    // Se este template for marcado como padrão, remover o padrão dos outros
    if (createTemplateDto.isDefault) {
      await this.prisma.template.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.template.create({
      data: {
        name: createTemplateDto.name,
        imageUrl: createTemplateDto.imageUrl,
        background: createTemplateDto.background,
        width: createTemplateDto.width || 1080,
        height: createTemplateDto.height || 1920,
        elements: createTemplateDto.elements || [],
        isDefault: createTemplateDto.isDefault || false,
      },
    });
  }

  async findAll() {
    return this.prisma.template.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.template.findUnique({
      where: { id },
    });
  }

  async findDefault() {
    return this.prisma.template.findFirst({
      where: { isDefault: true },
    });
  }

  async update(id: string, updateTemplateDto: UpdateTemplateDto) {
    // Se este template for marcado como padrão, remover o padrão dos outros
    if (updateTemplateDto.isDefault) {
      await this.prisma.template.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updateData: any = {};
    if (updateTemplateDto.name !== undefined)
      updateData.name = updateTemplateDto.name;
    if (updateTemplateDto.imageUrl !== undefined)
      updateData.imageUrl = updateTemplateDto.imageUrl;
    if (updateTemplateDto.background !== undefined)
      updateData.background = updateTemplateDto.background;
    if (updateTemplateDto.width !== undefined)
      updateData.width = updateTemplateDto.width;
    if (updateTemplateDto.height !== undefined)
      updateData.height = updateTemplateDto.height;
    if (updateTemplateDto.elements !== undefined)
      updateData.elements = updateTemplateDto.elements;
    if (updateTemplateDto.isDefault !== undefined)
      updateData.isDefault = updateTemplateDto.isDefault;

    return this.prisma.template.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    return this.prisma.template.delete({
      where: { id },
    });
  }
}
