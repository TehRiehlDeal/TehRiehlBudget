import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';
import { AuthModule } from '../auth/auth.module';
import { ValuationsModule } from '../valuations/valuations.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [AuthModule, ValuationsModule, ActivityLogModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
