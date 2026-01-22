import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCopyMessageDto } from './dto/create-copy-message.dto';

@Injectable()
export class CopyMessagesService {
  constructor(private prisma: PrismaService) {}

  async create(createCopyMessageDto: CreateCopyMessageDto) {
    return this.prisma.copyMessage.create({
      data: createCopyMessageDto,
      include: {
        category: true,
        subcategory: true,
      },
    });
  }

  async findAll(categoryId?: string, subcategoryId?: string) {
    return this.prisma.copyMessage.findMany({
      where: {
        ...(categoryId && { categoryId }),
        ...(subcategoryId && { subcategoryId }),
        isActive: true,
      },
      include: {
        category: true,
        subcategory: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.copyMessage.findUnique({
      where: { id },
      include: {
        category: true,
        subcategory: true,
      },
    });
  }

  async getRandomHook(categorySlug?: string, subcategorySlug?: string): Promise<string | undefined> {
    if (!categorySlug) {
      return undefined;
    }

    // Buscar categoria pelo slug
    const category = await this.prisma.category.findUnique({
      where: { slug: categorySlug },
    });

    if (!category) {
      return undefined;
    }

    let copies: { message: string }[] = [];

    // Se houver subcategoria, buscar por ela primeiro
    if (subcategorySlug) {
      const subcategory = await this.prisma.subcategory.findFirst({
        where: {
          slug: subcategorySlug,
          categoryId: category.id,
        },
      });

      if (subcategory) {
        // Buscar copies específicas da subcategoria
        copies = await this.prisma.copyMessage.findMany({
          where: {
            categoryId: category.id,
            subcategoryId: subcategory.id,
            isActive: true,
          },
          select: { message: true },
        });
      }
    }

    // Se não encontrou copies específicas da subcategoria, buscar apenas por categoria
    if (copies.length === 0) {
      copies = await this.prisma.copyMessage.findMany({
        where: {
          categoryId: category.id,
          subcategoryId: null,
          isActive: true,
        },
        select: { message: true },
      });
    }

    if (copies.length === 0) {
      return undefined;
    }

    const selectedCopy = copies[Math.floor(Math.random() * copies.length)].message;
    return selectedCopy;
  }

  async update(id: string, updateData: Partial<CreateCopyMessageDto>) {
    return this.prisma.copyMessage.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        subcategory: true,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.copyMessage.delete({
      where: { id },
    });
  }

  /**
   * Retorna copies relacionadas a um Product
   */
  async getCopiesForProduct(productId: string): Promise<any[]> {
    const productCopyMessages = await this.prisma.productCopyMessage.findMany({
      where: {
        productId,
        copyMessage: {
          isActive: true,
        },
      },
      include: {
        copyMessage: {
          include: {
            category: true,
            subcategory: true,
          },
        },
      },
    });

    if (productCopyMessages.length === 0) {
      return [];
    }

    return productCopyMessages.map((pcm) => pcm.copyMessage);
  }

  /**
   * Retorna uma copy aleatória relacionada a um Product
   * Exclui copies já usadas (fornecidas em usedCopyIds)
   * Se não houver copies relacionadas, busca copies da mesma categoria do produto sem subcategoria
   */
  async getRandomCopyForProduct(
    productId: string,
    usedCopyIds: string[] = [],
    productCategoryId?: string,
  ): Promise<{ message: string; copyId: string } | undefined> {
    // Buscar copies relacionadas ao produto
    let copies = await this.getCopiesForProduct(productId);

    // Filtrar copies já usadas
    if (usedCopyIds.length > 0) {
      copies = copies.filter((copy) => !usedCopyIds.includes(copy.id));
    }

    // Se ainda há copies disponíveis, usar uma delas
    if (copies.length > 0) {
      const selectedCopy = copies[Math.floor(Math.random() * copies.length)];
      return {
        message: selectedCopy.message,
        copyId: selectedCopy.id,
      };
    }

    // Se não há copies relacionadas, buscar copies da mesma categoria do produto sem subcategoria
    if (productCategoryId) {

      const categoryCopies = await this.prisma.copyMessage.findMany({
        where: {
          categoryId: productCategoryId,
          subcategoryId: null, // Sem subcategoria
          isActive: true,
          // Excluir copies já usadas
          ...(usedCopyIds.length > 0 && {
            id: {
              notIn: usedCopyIds,
            },
          }),
        },
        include: {
          category: true,
          subcategory: true,
        },
      });

      if (categoryCopies.length > 0) {
        const selectedCopy =
          categoryCopies[Math.floor(Math.random() * categoryCopies.length)];
        return {
          message: selectedCopy.message,
          copyId: selectedCopy.id,
        };
      }
    }

    return undefined;
  }

  /**
   * Relaciona uma CopyMessage com um Product
   */
  async linkCopyToProduct(productId: string, copyMessageId: string): Promise<void> {
    // Verificar se já existe o relacionamento
    const existing = await this.prisma.productCopyMessage.findUnique({
      where: {
        productId_copyMessageId: {
          productId,
          copyMessageId,
        },
      },
    });

    if (existing) {
      return; // Já existe, não precisa criar novamente
    }

    await this.prisma.productCopyMessage.create({
      data: {
        productId,
        copyMessageId,
      },
    });
  }

  /**
   * Remove relacionamento entre CopyMessage e Product
   */
  async unlinkCopyFromProduct(
    productId: string,
    copyMessageId: string,
  ): Promise<void> {
    await this.prisma.productCopyMessage.deleteMany({
      where: {
        productId,
        copyMessageId,
      },
    });
  }
}

