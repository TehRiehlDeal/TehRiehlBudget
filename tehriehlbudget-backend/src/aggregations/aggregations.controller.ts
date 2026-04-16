import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AggregationsService } from './aggregations.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import type { User } from '@prisma/client';

class DateRangeQuery {
  startDate: string;
  endDate: string;
}

@Controller('aggregations')
@UseGuards(AuthGuard)
export class AggregationsController {
  constructor(private readonly aggregationsService: AggregationsService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: User, @Query() query: DateRangeQuery) {
    return this.aggregationsService.getSummary(
      user.id,
      query.startDate,
      query.endDate,
    );
  }

  @Get('spending-by-category')
  getSpendingByCategory(
    @CurrentUser() user: User,
    @Query() query: DateRangeQuery,
  ) {
    return this.aggregationsService.getSpendingByCategory(
      user.id,
      query.startDate,
      query.endDate,
    );
  }

  @Get('account-balance-history/:accountId')
  getAccountBalanceHistory(
    @CurrentUser() user: User,
    @Param('accountId') accountId: string,
    @Query('days') days?: string,
  ) {
    const parsed = days ? parseInt(days, 10) : undefined;
    const windowDays = Number.isFinite(parsed) && parsed! > 0 ? parsed : 90;
    return this.aggregationsService.getAccountBalanceHistory(
      user.id,
      accountId,
      windowDays,
    );
  }
}
