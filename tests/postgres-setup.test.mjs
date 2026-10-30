import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  setupOptions,
  setupTarget,
  safeTarget,
  scramVerifier,
  provision,
} from '../scripts/setup-local-postgres.mjs';

const credential = 'local-test-credential-only';
const env = {
  DATABASE_URL: `postgresql://fintrack:${credential}@127.0.0.1:5432/fintrack`,
  TEST_DATABASE_URL: `postgresql://fintrack_test:${credential}@127.0.0.1:5433/fintrack_test`,
};

test('setup requires one explicit environment and never selects both databases', () => {
  for (const args of [[], ['--development', '--test'], ['--all']])
    assert.throws(() => setupOptions(args));
  for (const [flag, expected] of [
    ['--development', 5432],
    ['--test', 5433],
  ]) {
    const target = setupTarget(setupOptions([flag]), env);
    assert.equal(target.port, expected);
    assert.ok(!JSON.stringify(safeTarget(target)).includes(credential));
  }
  for (const url of [
    env.DATABASE_URL.replace('/fintrack', '/other'),
    env.DATABASE_URL.replace('127.0.0.1', 'remote.example'),
    env.TEST_DATABASE_URL,
    `${env.DATABASE_URL}?options=unsafe`,
  ]) {
    assert.throws(() => setupTarget({ test: false }, { DATABASE_URL: url }));
  }
});

test('SCRAM provisioning sends a salted verifier and rejects unsupported plaintext normalization', () => {
  const verifier = scramVerifier(credential, Buffer.alloc(16, 1));
  assert.match(verifier, /^SCRAM-SHA-256\$4096:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
  assert.ok(!verifier.includes(credential));
  assert.notEqual(scramVerifier(credential), scramVerifier(credential));
  for (const value of ['short', 'password with spaces', 'non-ascii-password-é']) {
    assert.throws(() => scramVerifier(value));
  }
});

test('setup preserves existing role credentials unless reconciliation is explicit', async () => {
  const writes = [];
  const admin = {
    query: async (sql) => {
      if (sql.startsWith('SELECT oid, rolsuper')) return { rowCount: 1, rows: [{ oid: 42 }] };
      if (sql.startsWith('SELECT oid, pg_get'))
        return { rowCount: 1, rows: [{ oid: 12, owner: 'fintrack' }] };
      if (sql.includes('pg_shdepend')) return { rowCount: 0, rows: [] };
      writes.push(sql);
      return { rowCount: 0, rows: [] };
    },
  };
  const target = setupTarget({ test: false }, env);
  await provision(admin, target);
  assert.deepEqual(writes, []);
  await provision(admin, target, { reconcile: true });
  assert.equal(writes.length, 1);
  assert.ok(writes[0].startsWith('ALTER ROLE "fintrack" LOGIN PASSWORD'));
  assert.ok(!writes[0].includes(credential));
});

test('setup refuses another database owner or a privileged/shared role before mutation', async () => {
  const target = setupTarget({ test: false }, env);
  for (const mode of ['owner', 'privileged', 'shared']) {
    const admin = {
      query: async (sql) => {
        if (sql.startsWith('SELECT oid, rolsuper'))
          return { rowCount: 1, rows: [{ oid: 42, rolsuper: mode === 'privileged' }] };
        if (sql.startsWith('SELECT oid, pg_get'))
          return {
            rowCount: 1,
            rows: [{ oid: 12, owner: mode === 'owner' ? 'another_project' : 'fintrack' }],
          };
        if (sql.includes('pg_shdepend')) return { rowCount: 1, rows: [{}] };
        assert.fail('No mutation is allowed');
      },
    };
    await assert.rejects(provision(admin, target, { reconcile: true }));
  }
});
