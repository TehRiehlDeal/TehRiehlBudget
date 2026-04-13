import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { PlaidService } from './plaid.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';

jest.mock('@prisma/client', () => ({ PrismaClient: class {} }));

// Mock the plaid module
jest.mock('plaid', () => ({
  PlaidApi: jest.fn().mockImplementation(() => ({
    linkTokenCreate: jest.fn(),
    itemPublicTokenExchange: jest.fn(),
    transactionsSync: jest.fn(),
    accountsBalanceGet: jest.fn(),
    itemRemove: jest.fn(),
  })),
  Configuration: jest.fn(),
  PlaidEnvironments: { sandbox: 'https://sandbox.plaid.com' },
  Products: { transactions: 'transactions' },
  CountryCode: { Us: 'US' },
}));

describe('PlaidService', () => {
  let service: PlaidService;

  const userId = 'user-123';

  const mockPrisma = {
    plaidItem: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    plaidAccount: {
      create: jest.fn(),
    },
    account: {
      create: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      upsert: jest.fn(),
    },
  };

  const mockEncryption = {
    encrypt: jest.fn((v: string) => `enc_${v}`),
    decrypt: jest.fn((v: string) => v.replace('enc_', '')),
    encryptField: jest.fn((v: string | null) => v ? `enc_${v}` : null),
    decryptField: jest.fn((v: string | null) => v ? v.replace('enc_', '') : null),
  };

  const mockConfig = {
    getOrThrow: jest.fn((key: string) => {
      const vals: Record<string, string> = {
        PLAID_CLIENT_ID: 'test-client-id',
        PLAID_SECRET: 'test-secret',
        PLAID_ENV: 'sandbox',
      };
      return vals[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaidService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EncryptionService, useValue: mockEncryption },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<PlaidService>(PlaidService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createLinkToken', () => {
    it('should create a link token', async () => {
      const mockClient = service['plaidClient'];
      (mockClient.linkTokenCreate as jest.Mock).mockResolvedValue({
        data: { link_token: 'link-token-123' },
      });

      const result = await service.createLinkToken(userId);

      expect(result).toBe('link-token-123');
      expect(mockClient.linkTokenCreate).toHaveBeenCalled();
    });
  });

  describe('exchangePublicToken', () => {
    it('should exchange token and create PlaidItem + accounts', async () => {
      const mockClient = service['plaidClient'];
      (mockClient.itemPublicTokenExchange as jest.Mock).mockResolvedValue({
        data: { access_token: 'access-token-123', item_id: 'item-123' },
      });

      mockPrisma.plaidItem.create.mockResolvedValue({
        id: 'pi-1',
        itemId: 'item-123',
        userId,
      });
      mockPrisma.account.create.mockResolvedValue({ id: 'acc-new' });
      mockPrisma.plaidAccount.create.mockResolvedValue({});

      const result = await service.exchangePublicToken(userId, 'public-token', {
        institution: { name: 'Chase', institution_id: 'ins_1' },
        accounts: [
          { id: 'plaid-acc-1', name: 'Checking', type: 'depository', subtype: 'checking' },
        ],
      });

      expect(mockEncryption.encrypt).toHaveBeenCalledWith('access-token-123');
      expect(mockPrisma.plaidItem.create).toHaveBeenCalled();
      expect(result).toHaveProperty('itemId', 'item-123');
    });
  });

  describe('getItems', () => {
    it('should return user\'s plaid items', async () => {
      const items = [{ id: 'pi-1', institutionName: 'Chase', status: 'connected' }];
      mockPrisma.plaidItem.findMany.mockResolvedValue(items);

      const result = await service.getItems(userId);
      expect(result).toEqual(items);
    });
  });

  describe('removeItem', () => {
    it('should remove a plaid item', async () => {
      mockPrisma.plaidItem.findFirst.mockResolvedValue({
        id: 'pi-1',
        userId,
        accessToken: 'enc_token',
      });
      const mockClient = service['plaidClient'];
      (mockClient.itemRemove as jest.Mock).mockResolvedValue({});
      mockPrisma.plaidItem.delete.mockResolvedValue({});

      await service.removeItem(userId, 'pi-1');

      expect(mockClient.itemRemove).toHaveBeenCalled();
      expect(mockPrisma.plaidItem.delete).toHaveBeenCalledWith({ where: { id: 'pi-1' } });
    });

    it('should throw NotFoundException if item not found', async () => {
      mockPrisma.plaidItem.findFirst.mockResolvedValue(null);

      await expect(service.removeItem(userId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
