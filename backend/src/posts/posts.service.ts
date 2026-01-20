import { BadRequestException, Injectable } from '@nestjs/common';
import { CopyMessagesService } from '../copy-messages/copy-messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { ShopeeCacheService } from '../shopee/shopee-cache.service';
import { StorageService } from '../storage/storage.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { MarkupType } from './formatters/message.formatter';
import { normalizeUrl } from './helpers/url-normalizer.helper';
import { PublisherService } from './publisher.service';

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private publisherService: PublisherService,
    private copyMessagesService: CopyMessagesService,
    private storageService: StorageService,
    private shopeeCacheService: ShopeeCacheService,
  ) {}

  async create(createPostDto: CreatePostDto) {
    // Extrair overlayImage para não passar ao Prisma (não é campo do schema)
    // overlayImage é usado apenas no frontend para gerar a imagem final
    const {
      channelIds,
      product,
      templateId,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      overlayImage: _overlayImage,
      ...postData
    } = createPostDto;

    // Validar que imageUrl não seja base64
    if (
      postData.imageUrl &&
      !this.storageService.isValidImageUrl(postData.imageUrl)
    ) {
      throw new BadRequestException(
        'imageUrl must be a valid HTTP/HTTPS URL. Base64 images are not allowed.',
      );
    }

    const post = await this.prisma.post.create({
      data: {
        ...postData,
        template: templateId
          ? {
              connect: { id: templateId },
            }
          : undefined,
        postChannel: {
          create:
            channelIds?.map((channelId) => ({
              channelId,
            })) || [],
        },
        postProduct: product
          ? {
              create: {
                name: product.name,
                price: product.price,
                originalPrice: product.originalPrice,
                link: normalizeUrl(product.link),
                categoryId: product.categoryId,
                subcategoryId: product.subcategoryId,
                marketplace: product.marketplace,
              },
            }
          : undefined,
      },
      include: {
        postChannel: {
          include: {
            channel: true,
          },
        },
        template: true,
        postProduct: {
          include: {
            category: true,
            subcategory: true,
          },
        },
      },
    });

    // Cachear produto no Redis se for da Shopee
    if (product && product.marketplace === 'shopee' && post.postProduct) {
      await this.shopeeCacheService.cacheProduct(
        post.postProduct.link,
        post.postProduct.price,
        post.postProduct.originalPrice || undefined,
        post.createdAt,
      );
    }

    return post;
  }

  async findAll() {
    return this.prisma.post.findMany({
      include: {
        template: true,
        postChannel: {
          include: {
            channel: true,
          },
        },
        postProduct: {
          include: {
            category: true,
            subcategory: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.post.findUnique({
      where: { id },
      include: {
        template: true,
        postChannel: {
          include: {
            channel: true,
          },
        },
        postProduct: {
          include: {
            category: true,
            subcategory: true,
          },
        },
      },
    });
  }

  async update(id: string, updatePostDto: UpdatePostDto) {
    const channelIds = (updatePostDto as any).channelIds;
    const product = (updatePostDto as any).product;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { channelIds: _, product: __, ...postData } = updatePostDto as any;

    // Validar que imageUrl não seja base64
    if (
      postData.imageUrl &&
      !this.storageService.isValidImageUrl(postData.imageUrl)
    ) {
      throw new BadRequestException(
        'imageUrl must be a valid HTTP/HTTPS URL. Base64 images are not allowed.',
      );
    }

    // Se channelIds foi fornecido, atualizar as relações
    if (channelIds !== undefined) {
      // Remover todas as relações existentes
      await this.prisma.postChannel.deleteMany({
        where: { postId: id },
      });

      // Criar novas relações
      if (channelIds.length > 0) {
        await this.prisma.postChannel.createMany({
          data: channelIds.map((channelId) => ({
            postId: id,
            channelId,
          })),
        });
      }
    }

    // Buscar post atual para verificar se há imagem antiga
    const currentPost = await this.findOne(id);
    if (
      currentPost?.imageUrl &&
      postData.imageUrl &&
      currentPost.imageUrl !== postData.imageUrl
    ) {
      // Se a imagem foi alterada, deletar a imagem antiga
      await this.storageService.deleteImage(currentPost.imageUrl);
    } else if (currentPost?.imageUrl && !postData.imageUrl) {
      // Se a imagem foi removida (imageUrl vazio/null), deletar a imagem antiga
      await this.storageService.deleteImage(currentPost.imageUrl);
    }

    // Se product foi fornecido, atualizar ou criar o produto
    if (product !== undefined) {
      const existingProduct = await this.prisma.postProduct.findUnique({
        where: { postId: id },
      });

      if (existingProduct) {
        // Atualizar produto existente
        await this.prisma.postProduct.update({
          where: { postId: id },
          data: {
            name: product.name,
            price: product.price,
            originalPrice: product.originalPrice,
            link: normalizeUrl(product.link),
            categoryId: product.categoryId,
            subcategoryId: product.subcategoryId,
            marketplace: product.marketplace,
          },
        });
      } else if (product) {
        // Criar novo produto
        const newProduct = await this.prisma.postProduct.create({
          data: {
            postId: id,
            name: product.name,
            price: product.price,
            originalPrice: product.originalPrice,
            link: normalizeUrl(product.link),
            categoryId: product.categoryId,
            subcategoryId: product.subcategoryId,
            marketplace: product.marketplace,
          },
        });

        // Cachear produto no Redis se for da Shopee
        if (product.marketplace === 'shopee') {
          const currentPost = await this.findOne(id);
          await this.shopeeCacheService.cacheProduct(
            newProduct.link,
            newProduct.price,
            newProduct.originalPrice || undefined,
            currentPost?.createdAt,
          );
        }
      }
    }

    return this.prisma.post.update({
      where: { id },
      data: postData,
      include: {
        template: true,
        postChannel: {
          include: {
            channel: true,
          },
        },
        postProduct: {
          include: {
            category: true,
            subcategory: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    // Buscar post para deletar imagem associada
    const post = await this.findOne(id);
    if (post?.imageUrl) {
      // Deletar imagem do R2
      await this.storageService.deleteImage(post.imageUrl);
    }

    return this.prisma.post.delete({
      where: { id },
    });
  }

  async publish(id: string) {
    const post = await this.findOne(id);
    if (!post) {
      throw new Error('Post not found');
    }

    const results = [];

    for (const postChannel of post.postChannel) {
      if (!postChannel.channel.isActive) {
        continue;
      }

      try {
        // Determinar formato baseado no tipo de canal
        // Por padrão, usar HTML para Telegram, plain para outros
        let markupType: MarkupType = MarkupType.HTML;
        if (postChannel.channel.type !== 'telegram') {
          markupType = MarkupType.PLAIN;
        }

        const result = await this.publisherService.publishToChannel(
          postChannel.channel.type,
          postChannel.channel.chatId,
          post.title,
          post.message,
          post.imageUrl,
          markupType,
        );

        if (result.success) {
          await this.prisma.postChannel.update({
            where: { id: postChannel.id },
            data: {
              status: 'sent',
              sentAt: new Date(),
            },
          });

          results.push({
            channelId: postChannel.channelId,
            channelName: postChannel.channel.name,
            channelType: postChannel.channel.type,
            status: 'sent',
          });
        } else {
          throw new Error(result.error || 'Failed to publish');
        }
      } catch (error) {
        await this.prisma.postChannel.update({
          where: { id: postChannel.id },
          data: {
            status: 'failed',
          },
        });

        results.push({
          channelId: postChannel.channelId,
          channelName: postChannel.channel.name,
          channelType: postChannel.channel.type,
          status: 'failed',
          error: error.message,
        });
      }
    }

    await this.prisma.post.update({
      where: { id },
      data: { isPublished: true },
    });

    return results;
  }
}
