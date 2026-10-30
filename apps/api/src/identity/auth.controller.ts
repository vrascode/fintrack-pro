import {
  Body,
  Controller,
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
import { AccessTokenGuard, type AuthenticatedRequest } from './access-token.guard.js';
import { assertWebOrigin, readRefreshCookie, refreshCookie, publicSession } from './web-session.js';

interface CookieResponse {
  header(name: string, value: string): unknown;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() body: unknown, @Headers('origin') origin?: string) {
    assertWebOrigin(origin);
    return this.auth.register(body);
  }

  @Post('login')
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
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async restore(
    @Headers('cookie') cookie: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
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
