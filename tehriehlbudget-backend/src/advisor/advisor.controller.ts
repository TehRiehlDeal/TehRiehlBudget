import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdvisorService } from './advisor.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { User } from '@prisma/client';

@Controller('advisor')
@UseGuards(AuthGuard)
export class AdvisorController {
  constructor(private readonly advisorService: AdvisorService) {}

  @Get('insights')
  getInsights(@CurrentUser() user: User) {
    return this.advisorService.getAdvice(user.id);
  }
}
