import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard, type AuthenticatedRequest } from '../identity/access-token.guard.js';
import { CategoriesService } from './categories.service.js';

@Controller('categories')
@UseGuards(AccessTokenGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.categories.list(request.userId!);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.categories.create(request.userId!, body);
  }
}
