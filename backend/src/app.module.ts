import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AliexpressModule } from './aliexpress/aliexpress.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { ChannelsModule } from './channels/channels.module';
import { CopyMessagesModule } from './copy-messages/copy-messages.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { RedisModule } from './redis/redis.module';
import { ShopeeModule } from './shopee/shopee.module';
import { StorageModule } from './storage/storage.module';
import { TemplatesModule } from './templates/templates.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    PostsModule,
    ChannelsModule,
    TemplatesModule,
    CategoriesModule,
    CopyMessagesModule,
    ProductsModule,
    AliexpressModule,
    ShopeeModule,
    IntegrationsModule,
    StorageModule,
  ],
})
export class AppModule {}
