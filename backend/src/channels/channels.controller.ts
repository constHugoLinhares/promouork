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
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { ProductsService } from '../products/products.service';
import { CopyMessagesService } from '../copy-messages/copy-messages.service';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { CreateChannelProductDto } from './dto/create-channel-product.dto';

@Controller('channels')
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly productsService: ProductsService,
    private readonly copyMessagesService: CopyMessagesService,
  ) {}

  @Post()
  create(@Body() createChannelDto: CreateChannelDto) {
    return this.channelsService.create(createChannelDto);
  }

  @Get()
  findAll() {
    return this.channelsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.channelsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateChannelDto: UpdateChannelDto) {
    return this.channelsService.update(id, updateChannelDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.channelsService.remove(id);
    return { message: 'Canal deletado com sucesso' };
  }

  // Endpoints para gerenciar produtos do canal
  @Get(':id/products')
  async getChannelProducts(@Param('id') id: string) {
    return this.productsService.findByChannelId(id);
  }

  @Post(':id/products')
  async createChannelProduct(
    @Param('id') id: string,
    @Body() createProductDto: CreateChannelProductDto,
  ) {
    // Garantir que o channelId seja o do parâmetro
    return this.productsService.create({
      ...createProductDto,
      channelId: id,
    });
  }

  @Get(':id/products/:productId')
  async getChannelProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    const product = await this.productsService.findOne(productId);
    // Verificar se o produto pertence ao canal
    if (product && product.channelId === id) {
      return product;
    }
    throw new Error('Product not found in this channel');
  }

  @Patch(':id/products/:productId')
  async updateChannelProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body() updateData: Partial<CreateProductDto>,
  ) {
    const product = await this.productsService.findOne(productId);
    // Verificar se o produto pertence ao canal
    if (product && product.channelId === id) {
      // Não permitir alterar o channelId
      const { channelId, ...data } = updateData;
      return this.productsService.update(productId, data);
    }
    throw new Error('Product not found in this channel');
  }

  @Delete(':id/products/:productId')
  async deleteChannelProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    const product = await this.productsService.findOne(productId);
    // Verificar se o produto pertence ao canal
    if (product && product.channelId === id) {
      await this.productsService.remove(productId);
      return { message: 'Produto deletado com sucesso' };
    }
    throw new Error('Product not found in this channel');
  }

  @Post(':id/products/:productId/copies')
  async linkCopyToProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body('copyMessageId') copyMessageId: string,
  ) {
    const product = await this.productsService.findOne(productId);
    // Verificar se o produto pertence ao canal
    if (product && product.channelId === id) {
      await this.copyMessagesService.linkCopyToProduct(productId, copyMessageId);
      return { message: 'Copy relacionada com sucesso' };
    }
    throw new Error('Product not found in this channel');
  }

  @Delete(':id/products/:productId/copies/:copyId')
  async unlinkCopyFromProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Param('copyId') copyId: string,
  ) {
    const product = await this.productsService.findOne(productId);
    // Verificar se o produto pertence ao canal
    if (product && product.channelId === id) {
      await this.copyMessagesService.unlinkCopyFromProduct(productId, copyId);
      return { message: 'Copy desrelacionada com sucesso' };
    }
    throw new Error('Product not found in this channel');
  }
}
