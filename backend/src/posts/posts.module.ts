import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CopyMessagesModule } from '../copy-messages/copy-messages.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ProductsModule } from '../products/products.module';
import { ShopeeModule } from '../shopee/shopee.module';
import { StorageModule } from '../storage/storage.module';
import { DealsService } from './deals.service';
import { InstagramService } from './instagram.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PublisherService } from './publisher.service';
import { SchedulerService } from './scheduler.service';
import { SchedulersController } from './schedulers.controller';
import { TelegramService } from './telegram.service';
import { WhatsAppService } from './whatsapp.service';
// Adapters
import { AliAdapter } from './adapters/ali.adapter';
import { AmazonAdapter } from './adapters/amazon.adapter';
import { MLAdapter } from './adapters/ml.adapter';
import { ShopeeAdapter } from './adapters/shopee.adapter';
// Copy Strategies
import { FallbackCopyStrategy } from './strategies/fallback-copy.strategy';
import { TechCpuCopyStrategy } from './strategies/tech/tech-cpu-copy.strategy';
import { TechFonesCopyStrategy } from './strategies/tech/tech-fones-copy.strategy';
import { TechGpuCopyStrategy } from './strategies/tech/tech-gpu-copy.strategy';
import { TechMonitorCopyStrategy } from './strategies/tech/tech-monitor-copy.strategy';
import { TechMouseCopyStrategy } from './strategies/tech/tech-mouse-copy.strategy';
import { TechSsdCopyStrategy } from './strategies/tech/tech-ssd-copy.strategy';
import { TechTecladoCopyStrategy } from './strategies/tech/tech-teclado-copy.strategy';

@Module({
  imports: [
    CopyMessagesModule,
    ProductsModule,
    StorageModule,
    HttpModule,
    IntegrationsModule,
    ShopeeModule,
  ],
  controllers: [PostsController, SchedulersController],
  providers: [
    PostsService,
    TelegramService,
    InstagramService,
    WhatsAppService,
    PublisherService,
    DealsService,
    SchedulerService,
    // Adapters
    ShopeeAdapter,
    AmazonAdapter,
    MLAdapter,
    AliAdapter,
    // Copy Strategies
    TechCpuCopyStrategy,
    TechGpuCopyStrategy,
    TechMonitorCopyStrategy,
    TechTecladoCopyStrategy,
    TechMouseCopyStrategy,
    TechFonesCopyStrategy,
    TechSsdCopyStrategy,
    FallbackCopyStrategy,
  ],
  exports: [PostsService, DealsService],
})
export class PostsModule {}
