import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AccessTokenGuard, AuthRateLimitGuard],
})
export class AuthModule {}
