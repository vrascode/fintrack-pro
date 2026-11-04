import { Body, Controller, Get, Headers, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard, type AuthenticatedRequest } from '../identity/access-token.guard.js';
import { CardsService } from './cards.service.js';
import { CardLedgerService } from './card-ledger.service.js';
@Controller('cards')
@UseGuards(AccessTokenGuard)
export class CardsController {
  constructor(
    private readonly cards: CardsService,
    private readonly ledger: CardLedgerService,
  ) {}
  @Get(':id/ledger') ledgerView(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.ledger.overview(req.userId!, id);
  }
  @Post(':id/purchases') purchase(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: unknown,
  ) {
    return this.ledger.purchase(req.userId!, id, key, body);
  }
  @Post(':id/purchases/:purchaseId/cancel') cancelPurchase(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('purchaseId') purchaseId: string,
  ) {
    return this.ledger.cancelPurchase(req.userId!, id, purchaseId);
  }
  @Post(':id/payments') pay(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: unknown,
  ) {
    return this.ledger.pay(req.userId!, id, key, body);
  }
  @Get() list(@Req() req: AuthenticatedRequest) {
    return this.cards.list(req.userId!);
  }
  @Post() create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.cards.create(req.userId!, body);
  }
  @Patch(':id') update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.cards.update(req.userId!, id, body);
  }
}
