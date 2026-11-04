import { Body, Controller, Get, Headers, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard, type AuthenticatedRequest } from '../identity/access-token.guard.js';
import { BillsService } from './bills.service.js';

@Controller('bills')
@UseGuards(AccessTokenGuard)
export class BillsController {
  constructor(private readonly bills: BillsService) {}
  @Get() list(@Req() req: AuthenticatedRequest) {
    return this.bills.list(req.userId!);
  }
  @Post() create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.bills.create(req.userId!, body);
  }
  @Patch(':id') update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.bills.update(req.userId!, id, body);
  }
  @Post(':id/cancel') cancel(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.bills.cancel(req.userId!, id);
  }
  @Post(':id/pay') pay(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: unknown,
  ) {
    return this.bills.pay(req.userId!, id, key, body);
  }
}
