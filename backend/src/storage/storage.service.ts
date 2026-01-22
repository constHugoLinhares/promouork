import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export interface PresignUrlRequest {
  type: 'post' | 'template';
  fileName: string;
  contentType: string;
}

export interface PresignUrlResponse {
  uploadUrl: string; // URL do worker para upload
  publicUrl: string; // URL pública onde a imagem ficará disponível
  expiresIn: number;
  token?: string; // Token JWT para autenticação no worker (se usar worker)
}

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl: string;
  private workerUrl: string;

  constructor(private configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
    );
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') || '';
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL') || '';
    this.workerUrl = this.configService.get<string>('WORKER_UPLOAD_URL') || '';

    if (!accountId || !accessKeyId || !secretAccessKey || !this.bucketName) {
      throw new Error('R2 configuration is missing');
    }

    // R2 usa S3-compatible API
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Gera uma URL de upload (worker ou presigned URL)
   * Prioriza o worker se configurado, caso contrário usa presigned URL direta
   * @param userId UUID do usuário
   * @param request Informações do upload
   * @returns URL de upload e URL pública
   */
  async generatePresignedUrl(
    userId: string,
    request: PresignUrlRequest,
  ): Promise<PresignUrlResponse> {
    // Gerar nome único para o arquivo
    const fileExtension = request.fileName.split('.').pop() || 'png';
    const uniqueFileName = `${randomUUID()}.${fileExtension}`;

    // Construir path: users/{userId}/{type}/{fileName}
    const key = `users/${userId}/${request.type}/${uniqueFileName}`;

    // Construir URL pública
    const publicUrl = `${this.publicUrl}/${key}`;
    const expiresIn = 3600; // 1 hora

    // Se worker estiver configurado, usar worker (resolve problemas de CORS)
    if (this.workerUrl) {
      return {
        uploadUrl: this.workerUrl, // URL do worker
        publicUrl,
        expiresIn,
      };
    }

    // Fallback: usar presigned URL direta (pode ter problemas de CORS)
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: request.contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn,
    });

    return {
      uploadUrl,
      publicUrl,
      expiresIn,
    };
  }

  /**
   * Extrai o key (path) do R2 a partir de uma URL pública
   * @param publicUrl URL pública da imagem
   * @returns Key do objeto no R2 ou null se não for uma URL válida
   */
  extractKeyFromUrl(publicUrl: string): string | null {
    if (!publicUrl || !this.publicUrl) {
      return null;
    }

    try {
      // Se for URL do worker, extrair o path
      if (
        this.workerUrl &&
        publicUrl.includes(this.workerUrl.replace('https://', '').split('/')[0])
      ) {
        const url = new URL(publicUrl);
        return url.pathname.substring(1); // Remove a barra inicial
      }

      // Se for URL direta do R2
      if (publicUrl.includes(this.publicUrl)) {
        const url = new URL(publicUrl);
        return url.pathname.substring(1); // Remove a barra inicial
      }

      // Tentar extrair de qualquer URL do R2
      const r2Pattern = /users\/[^/]+\/(post|template)\/[^/?]+/;
      const match = publicUrl.match(r2Pattern);
      if (match) {
        return match[0];
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Deleta uma imagem do R2
   * @param imageUrl URL pública da imagem a ser deletada
   * @returns true se deletado com sucesso, false caso contrário
   */
  async deleteImage(imageUrl: string): Promise<boolean> {
    if (!imageUrl) {
      return false;
    }

    const key = this.extractKeyFromUrl(imageUrl);
    if (!key) {
      return false;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Valida se uma URL é uma URL válida (não base64)
   */
  isValidImageUrl(url: string): boolean {
    if (!url || url.trim() === '') {
      return false;
    }

    // Não aceitar data URLs (base64)
    if (url.startsWith('data:image/')) {
      return false;
    }

    // Verificar se é uma URL HTTP/HTTPS válida
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
