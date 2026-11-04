import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Header,
  Headers,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import { AccessTokenGuard, type AuthenticatedRequest } from './access-token.guard.js';
import { assertWebOrigin, readRefreshCookie, refreshCookie, publicSession } from './web-session.js';

interface CookieResponse {
  header(name: string, value: string): unknown;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @Header('Cache-Control', 'no-store')
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.me(request.userId!);
  }

  @Post('refresh')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async refresh(
    @Body() body: unknown,
    @Headers('origin') origin: string | undefined,
    @Headers('cookie') cookie: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    assertWebOrigin(origin);
    const token = origin
      ? readRefreshCookie(cookie)
      : typeof body === 'object' &&
          body !== null &&
          'refreshToken' in body &&
          typeof body.refreshToken === 'string'
        ? body.refreshToken
        : '';
    const session = await this.auth.restore(token);
    if (origin) response.header('Set-Cookie', refreshCookie(session.refreshToken));
    return origin ? publicSession(session) : session;
  }

  @Post('register')
  @UseGuards(AuthRateLimitGuard)
  register(@Body() body: unknown, @Headers('origin') origin?: string) {
    assertWebOrigin(origin);
    return this.auth.register(body);
  }

  @Post('login')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: CookieResponse,
    @Headers('origin') origin?: string,
  ) {
    assertWebOrigin(origin);
    const session = await this.auth.login(body);
    if (origin) response.header('Set-Cookie', refreshCookie(session.refreshToken));
    return origin ? publicSession(session) : session;
  }

  @Post('session')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async restore(
    @Headers('cookie') cookie: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    if (!origin) throw new ForbiddenException('Browser Origin is required.');
    assertWebOrigin(origin);
    const session = await this.auth.restore(readRefreshCookie(cookie));
    response.header('Set-Cookie', refreshCookie(session.refreshToken));
    return publicSession(session);
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
    @Headers('origin') origin?: string,
  ) {
    assertWebOrigin(origin);
    if (!request.sessionId) throw new UnauthorizedException();
    response.header('Set-Cookie', refreshCookie('', true));
    return this.auth.logout(request.sessionId);
  }
}
