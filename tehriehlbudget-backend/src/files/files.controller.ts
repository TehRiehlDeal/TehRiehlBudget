import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FilesService } from './files.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { User } from '@prisma/client';
import { resolve } from 'path';

@Controller('files')
@UseGuards(AuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const path = this.filesService.saveFile(user.id, file);
    return { path };
  }

  @Get(':userId/:filename')
  serve(
    @CurrentUser() user: User,
    @Param('userId') userId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    if (user.id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const filePath = this.filesService.getFilePath(`receipts/${userId}/${filename}`);
    res.sendFile(resolve(filePath));
  }
}
