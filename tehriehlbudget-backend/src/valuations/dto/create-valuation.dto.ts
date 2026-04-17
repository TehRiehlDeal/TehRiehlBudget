import { IsDateString, IsNumber } from 'class-validator';

export class CreateValuationDto {
  @IsDateString()
  date: string;

  @IsNumber()
  value: number;
}
