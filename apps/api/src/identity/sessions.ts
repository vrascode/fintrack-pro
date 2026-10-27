import { randomUUID } from 'node:crypto';
import { issueToken, matchesToken } from './tokens.js';

const minute = 60_000;
const day = 24 * 60 * minute;
export const sessionPolicy = Object.freeze({
  accessMs: 15 * minute,
  idleMs: 7 * day,
  maxMs: 30 * day,
});

export interface SessionState {
  id: string;
  userId: string;
  deviceName: string;
  accessTokenHash: string;
  accessExpiresAt: Date;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  createdAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
}

export interface RefreshState {
  id: string;
  sessionId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface SessionGrant {
  session: SessionState;
  refresh: RefreshState;
  // These values go to the client once. Persist only session and refresh.
  credentials: { accessToken: string; refreshToken: string };
}

function timestamp(now: Date): number {
  const value = now.getTime();
  if (!Number.isFinite(value)) throw new RangeError('Invalid session timestamp.');
  return value;
}

function grant(session: SessionState, now: Date): SessionGrant {
  const at = timestamp(now);
  const expiresAt = new Date(
    Math.min(at + sessionPolicy.idleMs, session.absoluteExpiresAt.getTime()),
  );
  const access = issueToken('access');
  const refresh = issueToken('refresh');
  return {
    session: {
      ...session,
      accessTokenHash: access.hash,
      accessExpiresAt: new Date(Math.min(at + sessionPolicy.accessMs, expiresAt.getTime())),
      expiresAt,
      lastUsedAt: new Date(at),
    },
    refresh: {
      id: randomUUID(),
      sessionId: session.id,
      tokenHash: refresh.hash,
      createdAt: new Date(at),
      expiresAt: new Date(expiresAt),
      consumedAt: null,
    },
    credentials: { accessToken: access.value, refreshToken: refresh.value },
  };
}

export function createSession(userId: string, deviceName: string, now: Date): SessionGrant {
  const at = timestamp(now);
  if (!deviceName.trim() || deviceName.trim().length > 100) {
    throw new RangeError('Device name must contain between 1 and 100 characters.');
  }
  return grant(
    {
      id: randomUUID(),
      userId,
      deviceName: deviceName.trim(),
      accessTokenHash: '',
      accessExpiresAt: new Date(at),
      expiresAt: new Date(at),
      absoluteExpiresAt: new Date(at + sessionPolicy.maxMs),
      createdAt: new Date(at),
      lastUsedAt: new Date(at),
      revokedAt: null,
    },
    now,
  );
}

function isActive(session: SessionState, now: Date): boolean {
  const at = timestamp(now);
  return (
    session.revokedAt === null &&
    at >= session.createdAt.getTime() &&
    at >= session.lastUsedAt.getTime() &&
    at < session.expiresAt.getTime() &&
    at < session.absoluteExpiresAt.getTime()
  );
}

export function acceptsAccess(session: SessionState, accessToken: string, now: Date): boolean {
  return (
    isActive(session, now) &&
    timestamp(now) < session.accessExpiresAt.getTime() &&
    matchesToken(accessToken, session.accessTokenHash, 'access')
  );
}

export function revokeSession(session: SessionState, now: Date): SessionState {
  if (timestamp(now) < session.createdAt.getTime())
    throw new RangeError('Invalid revocation time.');
  return { ...session, revokedAt: session.revokedAt ?? new Date(now) };
}

export type Rotation =
  | { status: 'invalid' }
  | { status: 'replay'; session: SessionState }
  | { status: 'rotated'; grant: SessionGrant; consumed: RefreshState };

// Pure transition only. The repository must lock the session row, load the token,
// and commit consumption + the new grant (or replay revocation) atomically.
// Keep consumed token hashes until absolute session expiry for replay detection.
export function rotateSession(
  session: SessionState,
  refresh: RefreshState,
  rawToken: string,
  now: Date,
): Rotation {
  if (
    !isActive(session, now) ||
    refresh.sessionId !== session.id ||
    timestamp(now) < refresh.createdAt.getTime() ||
    !matchesToken(rawToken, refresh.tokenHash, 'refresh')
  ) {
    return { status: 'invalid' };
  }
  // Detect known consumed tokens even after their own expiry, while the session lives.
  if (refresh.consumedAt !== null)
    return { status: 'replay', session: revokeSession(session, now) };
  if (timestamp(now) >= refresh.expiresAt.getTime()) return { status: 'invalid' };
  return {
    status: 'rotated',
    grant: grant(session, now),
    consumed: { ...refresh, consumedAt: new Date(now) },
  };
}
