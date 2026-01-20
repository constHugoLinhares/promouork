import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CopyMessagesService } from '../copy-messages/copy-messages.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly copyMessagesService: CopyMessagesService,
  ) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('channelIds') channelIds?: string,
  ) {
    if (search) {
      const channelIdsArray = channelIds
        ? channelIds.split(',').filter((id) => id.trim())
        : undefined;
      return this.productsService.search(search, 10, channelIdsArray);
    }
    return this.productsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Get(':id/copies')
  getCopies(@Param('id') id: string) {
    return this.productsService.getCopiesForProduct(id);
  }

  @Post(':id/copies')
  linkCopy(@Param('id') id: string, @Body('copyMessageId') copyMessageId: string) {
    return this.copyMessagesService.linkCopyToProduct(id, copyMessageId);
  }

  @Delete(':id/copies/:copyId')
  unlinkCopy(@Param('id') id: string, @Param('copyId') copyId: string) {
    return this.copyMessagesService.unlinkCopyFromProduct(id, copyId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateData: Partial<CreateProductDto>) {
    return this.productsService.update(id, updateData);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
