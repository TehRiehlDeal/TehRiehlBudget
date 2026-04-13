import { Module } from '@nestjs/common';
import { AdvisorService } from './advisor.service';
import { AdvisorController } from './advisor.controller';
import { AggregationsModule } from '../aggregations/aggregations.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, AggregationsModule],
  controllers: [AdvisorController],
  providers: [AdvisorService],
})
export class AdvisorModule {}
