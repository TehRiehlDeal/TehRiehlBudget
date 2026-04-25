import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ActivityLogService,
  type ActivityLogFilters,
} from './activity-log.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import type { User } from '@prisma/client';

@Controller('activity')
@UseGuards(AuthGuard)
export class ActivityLogController {
  constructor(private readonly activityLog: ActivityLogService) {}

  @Get()
  findAll(@CurrentUser() user: User, @Query() filters: ActivityLogFilters) {
    return this.activityLog.findAll(user.id, filters);
  }
}
