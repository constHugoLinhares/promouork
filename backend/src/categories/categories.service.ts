import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  // Categories
  async createCategory(createCategoryDto: CreateCategoryDto) {
    const slug = createCategoryDto.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    return this.prisma.category.create({
      data: {
        ...createCategoryDto,
        slug,
      },
      include: {
        subcategories: true,
      },
    });
  }

  async findAllCategories() {
    return this.prisma.category.findMany({
      include: {
        subcategories: {
          where: { isActive: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOneCategory(id: string) {
    return this.prisma.category.findUnique({
      where: { id },
      include: {
        subcategories: true,
      },
    });
  }

  async updateCategory(id: string, updateData: Partial<CreateCategoryDto>) {
    const data: any = { ...updateData };
    
    if (updateData.name) {
      data.slug = updateData.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    return this.prisma.category.update({
      where: { id },
      data,
      include: {
        subcategories: true,
      },
    });
  }

  async removeCategory(id: string) {
    return this.prisma.category.delete({
      where: { id },
    });
  }

  // Subcategories
  async createSubcategory(createSubcategoryDto: CreateSubcategoryDto) {
    const slug = createSubcategoryDto.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    return this.prisma.subcategory.create({
      data: {
        ...createSubcategoryDto,
        slug,
      },
      include: {
        category: true,
      },
    });
  }

  async findAllSubcategories(categoryId?: string) {
    return this.prisma.subcategory.findMany({
      where: categoryId ? { categoryId } : undefined,
      include: {
        category: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOneSubcategory(id: string) {
    return this.prisma.subcategory.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });
  }

  async updateSubcategory(id: string, updateData: Partial<CreateSubcategoryDto>) {
    const data: any = { ...updateData };
    
    if (updateData.name) {
      data.slug = updateData.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    return this.prisma.subcategory.update({
      where: { id },
      data,
      include: {
        category: true,
      },
    });
  }

  async removeSubcategory(id: string) {
    return this.prisma.subcategory.delete({
      where: { id },
    });
  }
}

