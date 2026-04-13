import { Test, TestingModule } from '@nestjs/testing';
import { PlaidController } from './plaid.controller';
import { PlaidService } from './plaid.service';
import { AuthGuard } from '../auth/auth.guard';

jest.mock('@prisma/client', () => ({ PrismaClient: class {} }));

describe('PlaidController', () => {
  let controller: PlaidController;

  const mockUser = { id: 'user-123' } as any;

  const mockService = {
    createLinkToken: jest.fn().mockResolvedValue('link-token-abc'),
    exchangePublicToken: jest.fn().mockResolvedValue({ id: 'pi-1', itemId: 'item-123' }),
    syncBalances: jest.fn().mockResolvedValue(undefined),
    getItems: jest.fn().mockResolvedValue([{ id: 'pi-1', institutionName: 'Chase' }]),
    removeItem: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlaidController],
      providers: [{ provide: PlaidService, useValue: mockService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PlaidController>(PlaidController);
  });

  it('should create a link token', async () => {
    const result = await controller.createLinkToken(mockUser);
    expect(result).toEqual({ linkToken: 'link-token-abc' });
  });

  it('should exchange a public token', async () => {
    const result = await controller.exchangePublicToken(mockUser, {
      publicToken: 'public-token',
      metadata: { institution: { name: 'Chase' }, accounts: [] },
    });
    expect(mockService.exchangePublicToken).toHaveBeenCalledWith(
      'user-123',
      'public-token',
      { institution: { name: 'Chase' }, accounts: [] },
    );
    expect(result).toHaveProperty('itemId');
  });

  it('should sync balances', async () => {
    await controller.sync(mockUser, 'pi-1');
    expect(mockService.syncBalances).toHaveBeenCalledWith('pi-1');
  });

  it('should list items', async () => {
    const result = await controller.getItems(mockUser);
    expect(result).toHaveLength(1);
  });

  it('should remove an item', async () => {
    await controller.removeItem(mockUser, 'pi-1');
    expect(mockService.removeItem).toHaveBeenCalledWith('user-123', 'pi-1');
  });
});
