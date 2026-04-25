import { Module } from '@nestjs/common';
import { ValuationsService } from './valuations.service';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  providers: [ValuationsService],
  exports: [ValuationsService],
})
export class ValuationsModule {}
