import { Module } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { ProductsModule } from '../products/products.module';
import { CopyMessagesModule } from '../copy-messages/copy-messages.module';

@Module({
  imports: [ProductsModule, CopyMessagesModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}

