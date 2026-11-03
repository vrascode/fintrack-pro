import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller.js';
import { TransactionsService } from './transactions.service.js';
import { TransactionChangesService } from './transaction-changes.service.js';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionChangesService],
})
export class TransactionsModule {}
