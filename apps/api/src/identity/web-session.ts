import { ForbiddenException } from '@nestjs/common';
import type { AuthSession } from '@fintrack/shared';
import { createOriginPolicy } from '../config/cors.js';

export function publicSession(session: AuthSession) {
  return {
    userId: session.userId,
    sessionId: session.sessionId,
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
  };
}

export function assertWebOrigin(origin: string | undefined) {
  if (origin !== undefined && !createOriginPolicy()(origin))
    throw new ForbiddenException('Origin is not allowed.');
}

export function refreshCookie(token: string, clear = false): string {
  return `fintrack_refresh=${clear ? '' : token}; HttpOnly; SameSite=Strict; Path=/v1/auth; Max-Age=${clear ? 0 : 604800}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function readRefreshCookie(header: string | undefined): string {
  return (
    header
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('fintrack_refresh='))
      ?.slice('fintrack_refresh='.length) ?? ''
  );
}
