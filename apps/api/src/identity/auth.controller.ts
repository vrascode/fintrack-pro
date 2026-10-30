import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() body: unknown) {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown) {
    return this.auth.login(body);
  }
}
