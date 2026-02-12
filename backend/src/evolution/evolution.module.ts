import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { EvolutionController } from './evolution.controller';
import { EvolutionService } from './evolution.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 0,
    }),
    IntegrationsModule,
  ],
  controllers: [EvolutionController],
  providers: [EvolutionService],
  exports: [EvolutionService],
})
export class EvolutionModule {}
