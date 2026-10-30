import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard, type AuthenticatedRequest } from '../identity/access-token.guard.js';
import { AccountsService } from './accounts.service.js';

@Controller('accounts')
@UseGuards(AccessTokenGuard)
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.accounts.list(request.userId!);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.accounts.create(request.userId!, body);
  }
}
