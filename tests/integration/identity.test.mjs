// This suite uses real PostgreSQL and the generated Prisma client. No mock fallback.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { validateTestDatabaseUrl } from '../../scripts/database.mjs';
import { PasswordHasher } from '../../apps/api/dist/identity/password.js';
import { createSession } from '../../apps/api/dist/identity/sessions.js';
import { issueToken } from '../../apps/api/dist/identity/tokens.js';

const connectionString = validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);
const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { PrismaPg } = requireApi('@prisma/adapter-pg');
const { PrismaClient } = await import('../../apps/api/src/generated/prisma/client.ts');
const client = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }),
    log: [],
  });

test('identity migration persists across connections and enforces database constraints', async (t) => {
  const db = client();
  const ids = [];
  t.after(async () => {
    try {
      await db.user.deleteMany({ where: { id: { in: ids } } });
    } finally {
      await db.$disconnect();
    }
  });
  await db.$connect();
  const suffix = randomUUID();
  const now = new Date();
  const email = `${suffix}@example.test`;
  const userId = randomUUID();
  const passwordHash = await new PasswordHasher().hash('integration password test phrase');
  ids.push(userId);
  await db.user.create({ data: { id: userId, email, passwordHash } });
  await db.$disconnect();
  await db.$connect();
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: userId } })).email, email);

  await t.test(
    'email uniqueness, normalization and session foreign keys are enforced',
    async () => {
      const duplicateId = randomUUID();
      const uppercaseId = randomUUID();
      ids.push(duplicateId, uppercaseId);
      await assert.rejects(db.user.create({ data: { id: duplicateId, email, passwordHash } }), {
        code: 'P2002',
      });
      await assert.rejects(
        db.user.create({ data: { id: uppercaseId, email: `UPPER-${email}`, passwordHash } }),
      );
      await assert.rejects(
        db.session.create({
          data: createSession(randomUUID(), 'integration', now).session,
        }),
        { code: 'P2003' },
      );
    },
  );

  const grant = createSession(userId, 'integration', now);
  const session = await db.session.create({ data: grant.session });
  const refresh = await db.refreshToken.create({ data: grant.refresh });

  await t.test('concurrent token consumption has exactly one winner', async () => {
    const peer = client();
    try {
      const consume = (connection) =>
        connection.refreshToken.updateMany({
          where: { id: refresh.id, consumedAt: null, expiresAt: { gt: new Date() } },
          data: { consumedAt: new Date() },
        });
      const results = await Promise.all([consume(db), consume(peer)]);
      assert.equal(
        results.reduce((total, result) => total + result.count, 0),
        1,
      );
    } finally {
      await peer.$disconnect();
    }
  });

  await t.test('failed transactions roll back token consumption', async () => {
    const token = await db.authToken.create({
      data: {
        userId,
        purpose: 'RESET_PASSWORD',
        tokenHash: issueToken('resetPassword').hash,
        expiresAt: new Date(now.getTime() + 60_000),
      },
    });
    const rollback = new Error('intentional rollback');
    await assert.rejects(
      db.$transaction(async (tx) => {
        await tx.authToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
        throw rollback;
      }),
      (error) => error === rollback,
    );
    assert.equal(
      (await db.authToken.findUniqueOrThrow({ where: { id: token.id } })).consumedAt,
      null,
    );
  });

  await t.test('invalid expiry and raw tokens are rejected by constraints', async () => {
    await assert.rejects(
      db.session.update({ where: { id: session.id }, data: { expiresAt: now } }),
    );
    await assert.rejects(
      db.refreshToken.create({
        data: { sessionId: session.id, tokenHash: 'raw-token', expiresAt: session.expiresAt },
      }),
    );
  });

  await t.test('deleting a user cascades to sessions and both kinds of tokens', async () => {
    await db.user.delete({ where: { id: userId } });
    assert.equal(await db.session.count({ where: { userId } }), 0);
    assert.equal(await db.refreshToken.count({ where: { sessionId: session.id } }), 0);
    assert.equal(await db.authToken.count({ where: { userId } }), 0);
  });
});
