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
import { CopyMessagesService } from './copy-messages.service';
import { CreateCopyMessageDto } from './dto/create-copy-message.dto';

@Controller('copy-messages')
export class CopyMessagesController {
  constructor(private readonly copyMessagesService: CopyMessagesService) {}

  @Post()
  create(@Body() createCopyMessageDto: CreateCopyMessageDto) {
    return this.copyMessagesService.create(createCopyMessageDto);
  }

  @Get()
  findAll(
    @Query('categoryId') categoryId?: string,
    @Query('subcategoryId') subcategoryId?: string,
  ) {
    return this.copyMessagesService.findAll(categoryId, subcategoryId);
  }

  @Get('random-hook')
  getRandomHook(
    @Query('categorySlug') categorySlug?: string,
    @Query('subcategorySlug') subcategorySlug?: string,
  ) {
    return this.copyMessagesService.getRandomHook(categorySlug, subcategorySlug);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.copyMessagesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateCopyMessageDto>,
  ) {
    return this.copyMessagesService.update(id, updateData);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.copyMessagesService.remove(id);
  }
}

