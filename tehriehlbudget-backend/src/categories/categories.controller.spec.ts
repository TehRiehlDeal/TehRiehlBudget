import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { AuthGuard } from '../auth/auth.guard';

jest.mock('@prisma/client', () => ({ PrismaClient: class {} }));

describe('CategoriesController', () => {
  let controller: CategoriesController;

  const mockUser = { id: 'user-123' } as any;
  const mockCategory = { id: 'cat-1', userId: 'user-123', name: 'Groceries' };

  const mockService = {
    create: jest.fn().mockResolvedValue(mockCategory),
    findAll: jest.fn().mockResolvedValue([mockCategory]),
    findOne: jest.fn().mockResolvedValue(mockCategory),
    update: jest.fn().mockResolvedValue({ ...mockCategory, name: 'Food' }),
    remove: jest.fn().mockResolvedValue(mockCategory),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: mockService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  it('should create a category', async () => {
    const dto = { name: 'Groceries' };
    const result = await controller.create(mockUser, dto);
    expect(mockService.create).toHaveBeenCalledWith('user-123', dto);
    expect(result).toEqual(mockCategory);
  });

  it('should list all categories', async () => {
    const result = await controller.findAll(mockUser);
    expect(mockService.findAll).toHaveBeenCalledWith('user-123');
    expect(result).toEqual([mockCategory]);
  });

  it('should get one category', async () => {
    const result = await controller.findOne(mockUser, 'cat-1');
    expect(mockService.findOne).toHaveBeenCalledWith('user-123', 'cat-1');
    expect(result).toEqual(mockCategory);
  });

  it('should update a category', async () => {
    const result = await controller.update(mockUser, 'cat-1', { name: 'Food' });
    expect(mockService.update).toHaveBeenCalledWith('user-123', 'cat-1', { name: 'Food' });
    expect(result.name).toBe('Food');
  });

  it('should remove a category', async () => {
    const result = await controller.remove(mockUser, 'cat-1');
    expect(mockService.remove).toHaveBeenCalledWith('user-123', 'cat-1');
    expect(result).toEqual(mockCategory);
  });
});
