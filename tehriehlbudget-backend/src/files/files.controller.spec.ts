import { Test, TestingModule } from '@nestjs/testing';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { AuthGuard } from '../auth/auth.guard';
import { ForbiddenException } from '@nestjs/common';

jest.mock('@prisma/client', () => ({ PrismaClient: class {} }));

describe('FilesController', () => {
  let controller: FilesController;

  const mockUser = { id: 'user-123' } as any;

  const mockFilesService = {
    saveFile: jest.fn().mockReturnValue('receipts/user-123/abc.jpg'),
    getFilePath: jest.fn().mockReturnValue('/uploads/receipts/user-123/abc.jpg'),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [{ provide: FilesService, useValue: mockFilesService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FilesController>(FilesController);
  });

  describe('upload', () => {
    it('should upload a file and return the path', () => {
      const file = {
        originalname: 'receipt.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('data'),
      } as Express.Multer.File;

      const result = controller.upload(mockUser, file);

      expect(mockFilesService.saveFile).toHaveBeenCalledWith('user-123', file);
      expect(result).toEqual({ path: 'receipts/user-123/abc.jpg' });
    });
  });

  describe('serve', () => {
    it('should serve a file for the authenticated user', () => {
      const mockRes = {
        sendFile: jest.fn(),
      } as any;

      controller.serve(mockUser, 'user-123', 'abc.jpg', mockRes);

      expect(mockFilesService.getFilePath).toHaveBeenCalledWith('receipts/user-123/abc.jpg');
      expect(mockRes.sendFile).toHaveBeenCalled();
    });

    it('should reject access to another user\'s files', () => {
      const mockRes = { sendFile: jest.fn() } as any;

      expect(() => controller.serve(mockUser, 'other-user', 'abc.jpg', mockRes)).toThrow(
        ForbiddenException,
      );
    });
  });
});
