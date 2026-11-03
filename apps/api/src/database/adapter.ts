import { PrismaPg } from '@prisma/adapter-pg';

export function createDatabaseAdapter(connectionString: string) {
  const url = new URL(connectionString);
  // Prisma 7's pg adapter serializes Date parameters without an offset and
  // normalizes timestamptz results as UTC. Pin every pool connection to UTC;
  // leave server configuration and existing rows untouched.
  url.searchParams.set(
    'options',
    [url.searchParams.get('options'), '-c TimeZone=UTC'].filter(Boolean).join(' '),
  );
  return new PrismaPg({ connectionString: url.href, connectionTimeoutMillis: 5000 });
}
