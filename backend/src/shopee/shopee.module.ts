import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ShopeeCacheService } from './shopee-cache.service';
import { ShopeeController } from './shopee.controller';
import { ShopeeService } from './shopee.service';

@Module({
  imports: [HttpModule, PrismaModule],
  controllers: [ShopeeController],
  providers: [ShopeeService, ShopeeCacheService],
  exports: [ShopeeService, ShopeeCacheService],
})
export class ShopeeModule {}
