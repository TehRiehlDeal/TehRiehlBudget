import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';

const ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class FilesService {
  private readonly uploadDir: string;

  constructor(private configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || './uploads';
  }

  saveFile(userId: string, file: Express.Multer.File): string {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_MIMES.join(', ')}`,
      );
    }

    if (file.size > MAX_SIZE) {
      throw new BadRequestException(
        `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 10MB`,
      );
    }

    const userDir = join(this.uploadDir, 'receipts', userId);
    if (!existsSync(userDir)) {
      mkdirSync(userDir, { recursive: true });
    }

    const ext = extname(file.originalname).toLowerCase() || '.bin';
    const filename = `${randomUUID()}${ext}`;
    const fullPath = join(userDir, filename);

    writeFileSync(fullPath, file.buffer);

    // Return relative path (stored in DB)
    return `receipts/${userId}/${filename}`;
  }

  getFilePath(relativePath: string): string {
    return join(this.uploadDir, relativePath);
  }

  deleteFile(relativePath: string): void {
    const fullPath = this.getFilePath(relativePath);
    if (!existsSync(fullPath)) {
      throw new NotFoundException('File not found');
    }
    unlinkSync(fullPath);
  }
}
