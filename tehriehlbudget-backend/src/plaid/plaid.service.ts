import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import {
  PlaidApi,
  Configuration,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid';

@Injectable()
export class PlaidService {
  private plaidClient: PlaidApi;

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private config: ConfigService,
  ) {
    const configuration = new Configuration({
      basePath: PlaidEnvironments[this.config.getOrThrow<string>('PLAID_ENV')],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': this.config.getOrThrow<string>('PLAID_CLIENT_ID'),
          'PLAID-SECRET': this.config.getOrThrow<string>('PLAID_SECRET'),
        },
      },
    });
    this.plaidClient = new PlaidApi(configuration);
  }

  async createLinkToken(userId: string): Promise<string> {
    const response = await this.plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'TehRiehlBudget',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    return response.data.link_token;
  }

  async exchangePublicToken(
    userId: string,
    publicToken: string,
    metadata: any,
  ) {
    const { data } = await this.plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const encryptedToken = this.encryption.encrypt(data.access_token);

    const plaidItem = await this.prisma.plaidItem.create({
      data: {
        userId,
        itemId: data.item_id,
        accessToken: encryptedToken,
        institutionName: metadata.institution?.name,
      },
    });

    // Create local accounts for each Plaid account
    for (const plaidAcc of metadata.accounts || []) {
      const accountType = this.mapPlaidAccountType(plaidAcc.type, plaidAcc.subtype);
      const account = await this.prisma.account.create({
        data: {
          userId,
          name: plaidAcc.name,
          type: accountType,
          institution: metadata.institution?.name,
        },
      });

      await this.prisma.plaidAccount.create({
        data: {
          plaidItemId: plaidItem.id,
          accountId: account.id,
          plaidAccountId: plaidAcc.id,
        },
      });
    }

    return plaidItem;
  }

  async syncBalances(plaidItemId: string) {
    const item = await this.getItemOrThrow(plaidItemId);
    const accessToken = this.encryption.decrypt(item.accessToken);

    const { data } = await this.plaidClient.accountsBalanceGet({
      access_token: accessToken,
    });

    for (const plaidAcc of data.accounts) {
      const linked = await this.prisma.plaidAccount.findUnique({
        where: { plaidAccountId: plaidAcc.account_id },
      });
      if (linked) {
        await this.prisma.account.update({
          where: { id: linked.accountId },
          data: { balance: plaidAcc.balances.current ?? 0 },
        });
      }
    }

    await this.prisma.plaidItem.update({
      where: { id: plaidItemId },
      data: { lastSync: new Date(), syncError: null },
    });
  }

  async getItems(userId: string) {
    return this.prisma.plaidItem.findMany({
      where: { userId },
      include: { plaidAccounts: { include: { account: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeItem(userId: string, itemId: string) {
    const item = await this.prisma.plaidItem.findFirst({
      where: { id: itemId, userId },
    });
    if (!item) {
      throw new NotFoundException('Plaid item not found');
    }

    const accessToken = this.encryption.decrypt(item.accessToken);
    await this.plaidClient.itemRemove({ access_token: accessToken });
    await this.prisma.plaidItem.delete({ where: { id: itemId } });
  }

  private async getItemOrThrow(plaidItemId: string) {
    const item = await this.prisma.plaidItem.findUnique({
      where: { id: plaidItemId },
    });
    if (!item) throw new NotFoundException('Plaid item not found');
    return item;
  }

  private mapPlaidAccountType(
    type: string,
    subtype: string,
  ): 'CHECKING' | 'SAVINGS' | 'CREDIT' | 'LOAN' | 'STOCK' {
    if (type === 'depository') {
      return subtype === 'savings' ? 'SAVINGS' : 'CHECKING';
    }
    if (type === 'credit') return 'CREDIT';
    if (type === 'loan') return 'LOAN';
    if (type === 'investment') return 'STOCK';
    return 'CHECKING';
  }
}
