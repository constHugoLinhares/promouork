import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AliexpressController } from './aliexpress.controller';
import { AliexpressService } from './aliexpress.service';

@Module({
  imports: [HttpModule],
  controllers: [AliexpressController],
  providers: [AliexpressService],
  exports: [AliexpressService],
})
export class AliexpressModule {}
