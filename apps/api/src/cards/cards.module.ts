import { Module } from '@nestjs/common';
import { CardsController } from './cards.controller.js';
import { CardsService } from './cards.service.js';
import { CardLedgerService } from './card-ledger.service.js';
@Module({ controllers: [CardsController], providers: [CardsService, CardLedgerService] })
export class CardsModule {}
