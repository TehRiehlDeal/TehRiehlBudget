import { IsEnum, IsNotEmpty, IsOptional, IsNumber, IsString } from 'class-validator';
import { AccountType } from '@prisma/client';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(AccountType)
  type: AccountType;

  @IsNumber()
  @IsOptional()
  balance?: number;

  @IsString()
  @IsOptional()
  institution?: string;

  @IsString()
  @IsOptional()
  accountNumber?: string;
}
