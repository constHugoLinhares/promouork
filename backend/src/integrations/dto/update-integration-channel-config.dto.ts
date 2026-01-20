import { PartialType } from '@nestjs/mapped-types';
import { CreateIntegrationChannelConfigDto } from './create-integration-channel-config.dto';

export class UpdateIntegrationChannelConfigDto extends PartialType(
  CreateIntegrationChannelConfigDto,
) {}
