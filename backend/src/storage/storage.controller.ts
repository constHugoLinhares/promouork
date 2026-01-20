import { Body, Controller, Delete, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PresignUrlDto } from './dto/presign-url.dto';
import { StorageService } from './storage.service';

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('presign-url')
  async generatePresignedUrl(
    @CurrentUser() user: any,
    @Body() presignUrlDto: PresignUrlDto,
  ) {
    return this.storageService.generatePresignedUrl(user.id, {
      type: presignUrlDto.type,
      fileName: presignUrlDto.fileName,
      contentType: presignUrlDto.contentType,
    });
  }

  @Delete('image')
  async deleteImage(
    @CurrentUser() user: any,
    @Body() body: { imageUrl: string },
  ) {
    const deleted = await this.storageService.deleteImage(body.imageUrl);
    return { success: deleted };
  }
}
