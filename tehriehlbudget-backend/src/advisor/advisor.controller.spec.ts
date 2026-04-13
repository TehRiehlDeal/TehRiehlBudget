import { Test, TestingModule } from '@nestjs/testing';
import { AdvisorController } from './advisor.controller';
import { AdvisorService } from './advisor.service';
import { AuthGuard } from '../auth/auth.guard';

jest.mock('@prisma/client', () => ({ PrismaClient: class {} }));

describe('AdvisorController', () => {
  let controller: AdvisorController;

  const mockUser = { id: 'user-123' } as any;

  const mockService = {
    getAdvice: jest.fn().mockResolvedValue({
      insights: '1. Great savings rate!\n2. Consider reducing dining costs.',
      generatedAt: '2026-04-12T00:00:00.000Z',
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdvisorController],
      providers: [{ provide: AdvisorService, useValue: mockService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdvisorController>(AdvisorController);
  });

  it('should return AI-generated insights', async () => {
    const result = await controller.getInsights(mockUser);

    expect(mockService.getAdvice).toHaveBeenCalledWith('user-123');
    expect(result).toHaveProperty('insights');
    expect(result).toHaveProperty('generatedAt');
  });
});
