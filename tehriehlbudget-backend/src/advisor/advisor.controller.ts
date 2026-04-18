import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdvisorService } from './advisor.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import type { User } from '@prisma/client';
import { ChatRequestDto } from './dto/chat.dto';

@Controller('advisor')
@UseGuards(AuthGuard)
export class AdvisorController {
  constructor(private readonly advisorService: AdvisorService) {}

  @Get('insights')
  getInsights(@CurrentUser() user: User) {
    return this.advisorService.getAdvice(user.id);
  }

  @Post('chat')
  chat(@CurrentUser() user: User, @Body() body: ChatRequestDto) {
    return this.advisorService.chat(user.id, body.messages);
  }
}
