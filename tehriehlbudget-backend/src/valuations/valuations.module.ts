import { Module } from '@nestjs/common';
import { ValuationsService } from './valuations.service';

@Module({
  providers: [ValuationsService],
  exports: [ValuationsService],
})
export class ValuationsModule {}
