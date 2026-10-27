import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const prefixes = {
  access: 'ft_a_',
  refresh: 'ft_r_',
  verifyEmail: 'ft_v_',
  resetPassword: 'ft_p_',
} as const;
export type TokenPurpose = keyof typeof prefixes;

export function tokenDigest(value: string, purpose: TokenPurpose): string | null {
  const prefix = prefixes[purpose];
  if (!value.startsWith(prefix)) return null;
  const secret = value.slice(prefix.length);
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) return null;
  if (Buffer.from(secret, 'base64url').toString('base64url') !== secret) return null;
  return createHash('sha256').update(`fintrack:${purpose}:`).update(value).digest('hex');
}

export function issueToken(purpose: TokenPurpose): { value: string; hash: string } {
  const value = prefixes[purpose] + randomBytes(32).toString('base64url');
  const hash = tokenDigest(value, purpose);
  if (!hash) throw new Error('Token generation failed.');
  return { value, hash };
}

export function matchesToken(value: string, hash: string, purpose: TokenPurpose): boolean {
  const candidate = tokenDigest(value, purpose);
  if (!candidate || !/^[a-f0-9]{64}$/.test(hash)) return false;
  return timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
}
