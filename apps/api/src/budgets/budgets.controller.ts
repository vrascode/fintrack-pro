import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard, type AuthenticatedRequest } from '../identity/access-token.guard.js';
import { BudgetsService } from './budgets.service.js';

@Controller('budgets')
@UseGuards(AccessTokenGuard)
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.budgets.list(request.userId!, query);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.budgets.create(request.userId!, body);
  }

  @Patch(':id')
  update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.budgets.update(request.userId!, id, body);
  }

  @Delete(':id')
  remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.budgets.remove(request.userId!, id);
  }
}
