import { Module } from '@nestjs/common';
import { AggregationsService } from './aggregations.service';
import { AggregationsController } from './aggregations.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AggregationsController],
  providers: [AggregationsService],
  exports: [AggregationsService],
})
export class AggregationsModule {}
