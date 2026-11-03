import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateTestDatabaseUrl } from '../../scripts/database.mjs';
import { createDatabaseAdapter } from '../../apps/api/dist/database/adapter.js';
import { PrismaClient } from '../../apps/api/src/generated/prisma/client.ts';

test('Prisma stores and reads exact instants despite non-UTC database or URL defaults', async () => {
  const url = new URL(validateTestDatabaseUrl(process.env.TEST_DATABASE_URL));
  url.searchParams.set('options', '-c TimeZone=America/Sao_Paulo');
  const db = new PrismaClient({ adapter: createDatabaseAdapter(url.href), log: [] });
  try {
    const input = new Date('2026-11-02T12:34:56.789Z');
    // Compare a Date parameter against server-side epoch extraction, which
    // catches the symmetric read/write shift hidden by Date round-trip tests.
    const [row] =
      await db.$queryRaw`SELECT current_setting('TimeZone') AS timezone, ${input}::timestamptz AS instant, extract(epoch FROM ${input}::timestamptz)::float8 AS epoch`;
    assert.equal(row.timezone, 'UTC');
    assert.equal(row.instant.toISOString(), input.toISOString());
    assert.equal(Math.round(row.epoch * 1000), input.getTime());
    await Promise.all(
      Array.from({ length: 4 }, () =>
        db.$transaction(async (tx) => {
          const [value] = await tx.$queryRaw`SELECT current_setting('TimeZone') AS timezone`;
          assert.equal(value.timezone, 'UTC');
        }),
      ),
    );
  } finally {
    await db.$disconnect();
  }
});
