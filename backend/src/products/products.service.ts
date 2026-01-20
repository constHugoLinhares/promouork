import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Busca um Product por nome ou cria se não existir
   */
  async findOrCreate(name: string, channelId: string): Promise<any> {
    const trimmedName = name.trim();

    // Buscar por nome e canal (case-insensitive)
    let product = await this.prisma.product.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
        channelId: channelId,
      },
    });

    // Se não encontrou, criar
    if (!product) {
      product = await this.prisma.product.create({
        data: {
          name: trimmedName,
          channelId: channelId,
          isActive: true,
        },
      });
    }

    return product;
  }

  /**
   * Busca um Product por nome
   */
  async findByName(name: string): Promise<any | null> {
    return this.prisma.product.findFirst({
      where: {
        name: {
          equals: name.trim(),
          mode: 'insensitive',
        },
      },
      include: {
        channel: {
          include: {
            category: true,
          },
        },
        category: true,
        subcategory: true,
        copyMessages: {
          include: {
            copyMessage: true,
          },
        },
      },
    });
  }

  /**
   * Busca Products por IDs
   */
  async findByIds(ids: string[]): Promise<any[]> {
    return this.prisma.product.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      include: {
        channel: {
          include: {
            category: true,
          },
        },
        category: true,
        subcategory: true,
        copyMessages: {
          include: {
            copyMessage: true,
          },
        },
      },
    });
  }

  /**
   * Busca Products por termo de busca (para autocomplete)
   */
  async search(
    searchTerm: string,
    limit: number = 10,
    channelIds?: string[],
  ): Promise<any[]> {
    const where: any = {
      name: {
        contains: searchTerm,
        mode: 'insensitive',
      },
      isActive: true,
    };

    // Se channelIds for fornecido, filtrar por canais
    if (channelIds && channelIds.length > 0) {
      where.channelId = {
        in: channelIds,
      };
    }

    return this.prisma.product.findMany({
      where,
      take: limit,
      orderBy: {
        name: 'asc',
      },
      include: {
        channel: true,
        category: true,
        subcategory: true,
        copyMessages: {
          include: {
            copyMessage: true,
          },
        },
      },
    });
  }

  /**
   * Busca Products por canal
   */
  async findByChannelId(channelId: string): Promise<any[]> {
    return this.prisma.product.findMany({
      where: {
        channelId: channelId,
      },
      include: {
        channel: true,
        category: true,
        subcategory: true,
        copyMessages: {
          include: {
            copyMessage: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Cria um novo Product
   */
  async create(createProductDto: CreateProductDto): Promise<any> {
    // Verifica se o produto já existe
    const existingProduct = await this.prisma.product.findUnique({
      where: { name: createProductDto.name },
      include: {
        channel: true,
        category: true,
        subcategory: true,
        copyMessages: {
          include: {
            copyMessage: true,
          },
        },
      },
    });

    // Se já existe, retorna o produto existente
    if (existingProduct) return existingProduct;

    return this.prisma.product.create({
      data: createProductDto,
      include: {
        channel: true,
        category: true,
        subcategory: true,
        copyMessages: {
          include: {
            copyMessage: true,
          },
        },
      },
    });
  }

  /**
   * Retorna copies relacionadas a um Product
   */
  async getCopiesForProduct(productId: string): Promise<any[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        copyMessages: {
          where: {
            copyMessage: {
              isActive: true,
            },
          },
          include: {
            copyMessage: true,
          },
        },
      },
    });

    if (!product) {
      return [];
    }

    return product.copyMessages.map((pcm) => pcm.copyMessage);
  }

  /**
   * Retorna um Product por ID
   */
  async findOne(id: string): Promise<any | null> {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        channel: true,
        category: true,
        subcategory: true,
        copyMessages: {
          include: {
            copyMessage: true,
          },
        },
      },
    });
  }

  /**
   * Lista todos os Products
   */
  async findAll(): Promise<any[]> {
    return this.prisma.product.findMany({
      include: {
        channel: {
          include: {
            category: true,
          },
        },
        category: true,
        subcategory: true,
        copyMessages: {
          include: {
            copyMessage: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Atualiza um Product
   */
  async update(
    id: string,
    updateData: Partial<CreateProductDto>,
  ): Promise<any> {
    return this.prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        subcategory: true,
        copyMessages: {
          include: {
            copyMessage: true,
          },
        },
      },
    });
  }

  /**
   * Remove um Product
   * Também remove o produto dos schedulers que o utilizam
   */
  async remove(id: string): Promise<void> {
    // Buscar todos os schedulers (não há filtro direto para arrays em JSON no Prisma)
    const allSchedulers = await this.prisma.postScheduler.findMany();

    // Filtrar schedulers que têm este produto no config.productIds
    const schedulersToUpdate = allSchedulers.filter((scheduler) => {
      const config = scheduler.config as any;
      return (
        config?.productIds &&
        Array.isArray(config.productIds) &&
        config.productIds.includes(id)
      );
    });

    // Remover o productId de cada scheduler
    for (const scheduler of schedulersToUpdate) {
      const config = scheduler.config as any;
      const updatedProductIds = config.productIds.filter(
        (productId: string) => productId !== id,
      );

      await this.prisma.postScheduler.update({
        where: { id: scheduler.id },
        data: {
          config: {
            ...config,
            productIds: updatedProductIds,
          },
        },
      });
    }

    // Deletar o produto
    await this.prisma.product.delete({
      where: { id },
    });
  }
}
