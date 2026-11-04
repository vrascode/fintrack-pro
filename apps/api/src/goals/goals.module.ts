import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module.js';
import { GoalsController } from './goals.controller.js';
import { GoalsService } from './goals.service.js';

@Module({ imports: [PrismaModule], controllers: [GoalsController], providers: [GoalsService] })
export class GoalsModule {}
