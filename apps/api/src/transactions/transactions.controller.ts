import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard, type AuthenticatedRequest } from '../identity/access-token.guard.js';
import { TransactionsService } from './transactions.service.js';
import { TransactionChangesService } from './transaction-changes.service.js';

@Controller('transactions')
@UseGuards(AccessTokenGuard)
export class TransactionsController {
  constructor(
    private readonly transactions: TransactionsService,
    private readonly changes: TransactionChangesService,
  ) {}

  @Patch(':id')
  edit(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.changes.edit(request.userId!, id, body);
  }

  @Delete(':id')
  remove(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.changes.void(request.userId!, id, body);
  }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.transactions.list(request.userId!, query);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ) {
    return this.transactions.create(request.userId!, idempotencyKey, body);
  }

  @Get(':id')
  detail(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.transactions.detail(request.userId!, id);
  }
}
