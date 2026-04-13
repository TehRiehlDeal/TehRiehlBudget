import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PlaidService } from './plaid.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { User } from '@prisma/client';

@Controller('plaid')
@UseGuards(AuthGuard)
export class PlaidController {
  constructor(private readonly plaidService: PlaidService) {}

  @Post('link-token')
  async createLinkToken(@CurrentUser() user: User) {
    const linkToken = await this.plaidService.createLinkToken(user.id);
    return { linkToken };
  }

  @Post('exchange-token')
  exchangePublicToken(
    @CurrentUser() user: User,
    @Body() body: { publicToken: string; metadata: any },
  ) {
    return this.plaidService.exchangePublicToken(
      user.id,
      body.publicToken,
      body.metadata,
    );
  }

  @Post('sync/:itemId')
  sync(@CurrentUser() user: User, @Param('itemId') itemId: string) {
    return this.plaidService.syncBalances(itemId);
  }

  @Get('items')
  getItems(@CurrentUser() user: User) {
    return this.plaidService.getItems(user.id);
  }

  @Delete('items/:itemId')
  removeItem(@CurrentUser() user: User, @Param('itemId') itemId: string) {
    return this.plaidService.removeItem(user.id, itemId);
  }
}
