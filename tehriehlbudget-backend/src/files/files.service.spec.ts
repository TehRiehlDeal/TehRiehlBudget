import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesService } from './files.service';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  readFileSync: jest.fn(),
}));

describe('FilesService', () => {
  let service: FilesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('./uploads'),
          },
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('saveFile', () => {
    it('should save a valid image file and return the path', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const file = {
        originalname: 'receipt.jpg',
        mimetype: 'image/jpeg',
        size: 1024 * 100, // 100KB
        buffer: Buffer.from('fake-image-data'),
      } as Express.Multer.File;

      const result = service.saveFile('user-123', file);

      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(result).toContain('user-123');
      expect(result).toMatch(/\.jpg$/);
    });

    it('should reject invalid file types', () => {
      const file = {
        originalname: 'malware.exe',
        mimetype: 'application/x-msdownload',
        size: 1024,
        buffer: Buffer.from('bad'),
      } as Express.Multer.File;

      expect(() => service.saveFile('user-123', file)).toThrow(BadRequestException);
    });

    it('should reject files exceeding size limit', () => {
      const file = {
        originalname: 'huge.jpg',
        mimetype: 'image/jpeg',
        size: 11 * 1024 * 1024, // 11MB
        buffer: Buffer.from('huge'),
      } as Express.Multer.File;

      expect(() => service.saveFile('user-123', file)).toThrow(BadRequestException);
    });

    it('should accept PDF files', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const file = {
        originalname: 'receipt.pdf',
        mimetype: 'application/pdf',
        size: 1024 * 500,
        buffer: Buffer.from('pdf-data'),
      } as Express.Multer.File;

      const result = service.saveFile('user-123', file);
      expect(result).toMatch(/\.pdf$/);
    });
  });

  describe('deleteFile', () => {
    it('should delete a file that exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      service.deleteFile('receipts/user-123/file.jpg');

      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('should throw NotFoundException for missing file', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      expect(() => service.deleteFile('receipts/user-123/missing.jpg')).toThrow(
        NotFoundException,
      );
    });
  });

  describe('getFilePath', () => {
    it('should return the full path for a file', () => {
      const result = service.getFilePath('receipts/user-123/file.jpg');
      expect(result).toContain('uploads');
      expect(result).toContain('file.jpg');
    });
  });
});
