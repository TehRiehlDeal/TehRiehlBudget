import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EncryptionModule } from './encryption/encryption.module';
import { AccountsModule } from './accounts/accounts.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { FilesModule } from './files/files.module';
import { AggregationsModule } from './aggregations/aggregations.module';
import { AdvisorModule } from './advisor/advisor.module';
import { ValuationsModule } from './valuations/valuations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    EncryptionModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    FilesModule,
    AggregationsModule,
    AdvisorModule,
    ValuationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
