import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AggregationsService } from './aggregations.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { User } from '@prisma/client';

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
}
