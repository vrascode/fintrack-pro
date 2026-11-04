import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module.js';
import { BudgetsController } from './budgets.controller.js';
import { BudgetsService } from './budgets.service.js';

@Module({ imports: [PrismaModule], controllers: [BudgetsController], providers: [BudgetsService] })
export class BudgetsModule {}
