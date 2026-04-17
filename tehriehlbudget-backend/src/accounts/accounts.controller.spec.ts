import { Test, TestingModule } from '@nestjs/testing';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { ValuationsService } from '../valuations/valuations.service';
import { AuthGuard } from '../auth/auth.guard';
import { AccountType } from '@prisma/client';

jest.mock('@prisma/client', () => ({
  PrismaClient: class {},
  AccountType: {
    CHECKING: 'CHECKING',
    SAVINGS: 'SAVINGS',
    CREDIT: 'CREDIT',
    LOAN: 'LOAN',
    STOCK: 'STOCK',
    CASH: 'CASH',
    INVESTMENT: 'INVESTMENT',
    RETIREMENT: 'RETIREMENT',
  },
}));

describe('AccountsController', () => {
  let controller: AccountsController;

  const mockUser = { id: 'user-123', supabaseId: 'sb-123', email: 'test@test.com' };
  const mockAccount = {
    id: 'acc-1',
    userId: 'user-123',
    name: 'Checking',
    type: AccountType.CHECKING,
    balance: 1000,
    institution: 'BECU',
    accountNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockService = {
    create: jest.fn().mockResolvedValue(mockAccount),
    findAll: jest.fn().mockResolvedValue([mockAccount]),
    findOne: jest.fn().mockResolvedValue(mockAccount),
    update: jest.fn().mockResolvedValue({ ...mockAccount, name: 'Updated' }),
    remove: jest.fn().mockResolvedValue(mockAccount),
    reorder: jest.fn().mockResolvedValue([mockAccount]),
  };

  const mockValuationsService = {
    create: jest.fn().mockResolvedValue({ id: 'v-1', accountId: 'acc-1', value: 100 }),
    list: jest.fn().mockResolvedValue([{ id: 'v-1', accountId: 'acc-1', value: 100 }]),
    remove: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        { provide: AccountsService, useValue: mockService },
        { provide: ValuationsService, useValue: mockValuationsService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AccountsController>(AccountsController);
  });

  it('should create an account', async () => {
    const dto = { name: 'Checking', type: AccountType.CHECKING };
    const result = await controller.create(mockUser as any, dto);
    expect(mockService.create).toHaveBeenCalledWith('user-123', dto);
    expect(result).toEqual(mockAccount);
  });

  it('should list all accounts', async () => {
    const result = await controller.findAll(mockUser as any);
    expect(mockService.findAll).toHaveBeenCalledWith('user-123');
    expect(result).toEqual([mockAccount]);
  });

  it('should get one account', async () => {
    const result = await controller.findOne(mockUser as any, 'acc-1');
    expect(mockService.findOne).toHaveBeenCalledWith('user-123', 'acc-1');
    expect(result).toEqual(mockAccount);
  });

  it('should update an account', async () => {
    const dto = { name: 'Updated' };
    const result = await controller.update(mockUser as any, 'acc-1', dto);
    expect(mockService.update).toHaveBeenCalledWith('user-123', 'acc-1', dto);
    expect(result.name).toBe('Updated');
  });

  it('should remove an account', async () => {
    const result = await controller.remove(mockUser as any, 'acc-1');
    expect(mockService.remove).toHaveBeenCalledWith('user-123', 'acc-1');
    expect(result).toEqual(mockAccount);
  });

  it('should reorder accounts', async () => {
    await controller.reorder(mockUser as any, { orderedIds: ['b', 'a'] });
    expect(mockService.reorder).toHaveBeenCalledWith('user-123', ['b', 'a']);
  });

  it('creates a valuation for an account', async () => {
    const dto = { date: '2026-04-17', value: 52340 };
    await controller.createValuation(mockUser as any, 'acc-1', dto);
    expect(mockValuationsService.create).toHaveBeenCalledWith('user-123', 'acc-1', dto);
  });

  it('lists valuations with default 365-day window', async () => {
    await controller.listValuations(mockUser as any, 'acc-1');
    expect(mockValuationsService.list).toHaveBeenCalledWith('user-123', 'acc-1', 365);
  });

  it('passes through custom days query param for valuation list', async () => {
    await controller.listValuations(mockUser as any, 'acc-1', '30');
    expect(mockValuationsService.list).toHaveBeenCalledWith('user-123', 'acc-1', 30);
  });

  it('removes a valuation', async () => {
    await controller.removeValuation(mockUser as any, 'v-1');
    expect(mockValuationsService.remove).toHaveBeenCalledWith('user-123', 'v-1');
  });
});
