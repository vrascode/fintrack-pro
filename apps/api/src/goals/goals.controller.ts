import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard, type AuthenticatedRequest } from '../identity/access-token.guard.js';
import { GoalsService } from './goals.service.js';

@Controller('goals')
@UseGuards(AccessTokenGuard)
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.goals.list(request.userId!);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.goals.create(request.userId!, body);
  }

  @Patch(':id')
  update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.goals.update(request.userId!, id, body);
  }

  @Post(':id/contributions')
  contribute(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: unknown,
  ) {
    return this.goals.contribute(request.userId!, id, key, body);
  }

  @Delete(':id/contributions/:contributionId')
  removeContribution(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('contributionId') contributionId: string,
  ) {
    return this.goals.removeContribution(request.userId!, id, contributionId);
  }

  @Delete(':id')
  remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.goals.remove(request.userId!, id);
  }
}
