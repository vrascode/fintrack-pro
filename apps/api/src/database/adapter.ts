import { PrismaPg } from '@prisma/adapter-pg';

export function createDatabaseAdapter(connectionString: string) {
  const url = new URL(connectionString);
  if (
    process.env.NODE_ENV === 'production' &&
    (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode') ?? ''))
  ) {
    throw new Error('Production PostgreSQL requires TLS (sslmode=require or stronger).');
  }
  // Prisma 7's pg adapter serializes Date parameters without an offset and
  // normalizes timestamptz results as UTC. Pin every pool connection to UTC;
  // leave server configuration and existing rows untouched.
  url.searchParams.set(
    'options',
    [url.searchParams.get('options'), '-c TimeZone=UTC'].filter(Boolean).join(' '),
  );
  return new PrismaPg({ connectionString: url.href, connectionTimeoutMillis: 5000, max: 5 });
}
