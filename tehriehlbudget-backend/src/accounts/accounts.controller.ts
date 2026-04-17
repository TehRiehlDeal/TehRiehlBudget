import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { ValuationsService } from '../valuations/valuations.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ReorderAccountsDto } from './dto/reorder-accounts.dto';
import { CreateValuationDto } from '../valuations/dto/create-valuation.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import type { User } from '@prisma/client';

@Controller('accounts')
@UseGuards(AuthGuard)
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly valuationsService: ValuationsService,
  ) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.accountsService.findAll(user.id);
  }

  @Patch('reorder')
  reorder(@CurrentUser() user: User, @Body() dto: ReorderAccountsDto) {
    return this.accountsService.reorder(user.id, dto.orderedIds);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.accountsService.findOne(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.accountsService.remove(user.id, id);
  }

  // Valuation snapshots for market-value accounts (STOCK / INVESTMENT / RETIREMENT)

  @Post(':id/valuations')
  createValuation(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CreateValuationDto,
  ) {
    return this.valuationsService.create(user.id, id, dto);
  }

  @Get(':id/valuations')
  listValuations(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    const parsed = days ? parseInt(days, 10) : undefined;
    const windowDays = Number.isFinite(parsed) && parsed! > 0 ? parsed : 365;
    return this.valuationsService.list(user.id, id, windowDays);
  }

  @Delete(':id/valuations/:valuationId')
  removeValuation(
    @CurrentUser() user: User,
    @Param('valuationId') valuationId: string,
  ) {
    return this.valuationsService.remove(user.id, valuationId);
  }
}
