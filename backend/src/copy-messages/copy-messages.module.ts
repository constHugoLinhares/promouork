import { Module } from '@nestjs/common';
import { CopyMessagesService } from './copy-messages.service';
import { CopyMessagesController } from './copy-messages.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CopyMessagesController],
  providers: [CopyMessagesService],
  exports: [CopyMessagesService],
})
export class CopyMessagesModule {}

