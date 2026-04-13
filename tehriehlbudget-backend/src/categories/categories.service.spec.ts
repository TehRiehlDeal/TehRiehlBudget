import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('@prisma/client', () => ({ PrismaClient: class {} }));

describe('CategoriesService', () => {
  let service: CategoriesService;

  const userId = 'user-123';
  const mockCategory = {
    id: 'cat-1',
    userId,
    name: 'Groceries',
    color: '#4CAF50',
    icon: 'shopping-cart',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrisma = {
    category: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  describe('create', () => {
    it('should create a category for the user', async () => {
      mockPrisma.category.create.mockResolvedValue(mockCategory);
      const result = await service.create(userId, { name: 'Groceries', color: '#4CAF50', icon: 'shopping-cart' });
      expect(mockPrisma.category.create).toHaveBeenCalledWith({
        data: { userId, name: 'Groceries', color: '#4CAF50', icon: 'shopping-cart' },
      });
      expect(result).toEqual(mockCategory);
    });
  });

  describe('findAll', () => {
    it('should return all categories for the user', async () => {
      mockPrisma.category.findMany.mockResolvedValue([mockCategory]);
      const result = await service.findAll(userId);
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([mockCategory]);
    });
  });

  describe('findOne', () => {
    it('should return a single category', async () => {
      mockPrisma.category.findFirst.mockResolvedValue(mockCategory);
      const result = await service.findOne(userId, 'cat-1');
      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.category.findFirst.mockResolvedValue(null);
      await expect(service.findOne(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      mockPrisma.category.findFirst.mockResolvedValue(mockCategory);
      mockPrisma.category.update.mockResolvedValue({ ...mockCategory, name: 'Food' });
      const result = await service.update(userId, 'cat-1', { name: 'Food' });
      expect(result.name).toBe('Food');
    });
  });

  describe('remove', () => {
    it('should delete a category', async () => {
      mockPrisma.category.findFirst.mockResolvedValue(mockCategory);
      mockPrisma.category.delete.mockResolvedValue(mockCategory);
      const result = await service.remove(userId, 'cat-1');
      expect(result).toEqual(mockCategory);
    });
  });
});
