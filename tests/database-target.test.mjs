import assert from 'node:assert/strict';
import { test } from 'node:test';
import { databaseEnvironment, validateTestDatabaseUrl } from '../scripts/database.mjs';

test('integration database guard accepts only explicit local test databases', () => {
  assert.equal(
    validateTestDatabaseUrl('postgresql://localhost:5433/fintrack_test'),
    'postgresql://localhost:5433/fintrack_test',
  );
  for (const url of [
    undefined,
    '',
    'postgresql://localhost/fintrack',
    'postgresql://db.example.com/fintrack_test',
    'postgresql://localhost/fintrack_test?schema=production',
    'postgresql://localhost/fintrack_test#fragment',
    'postgresql://localhost/%66intrack_test',
    'https://localhost/fintrack_test',
  ]) {
    assert.throws(() => validateTestDatabaseUrl(url));
  }
});

test('database tooling isolates test migrations from both production URLs', () => {
  const production = {
    DATABASE_URL: 'postgresql://pooled.example.test/production?sslmode=require',
    DIRECT_URL: 'postgresql://direct.example.test/production?sslmode=require',
    TEST_DATABASE_URL: 'postgresql://localhost:5433/fintrack_test',
  };
  const env = databaseEnvironment('test', production);
  assert.equal(env.DATABASE_URL, production.TEST_DATABASE_URL);
  assert.equal(env.DIRECT_URL, production.TEST_DATABASE_URL);
  assert.match(production.DIRECT_URL, /direct.example.test/);
  assert.throws(() => databaseEnvironment('test', { ...production, TEST_DATABASE_URL: '' }));
});

test('Prisma 7 CLI selects a direct migration URL without changing the API pool', async () => {
  const previous = { DATABASE_URL: process.env.DATABASE_URL, DIRECT_URL: process.env.DIRECT_URL };
  try {
    process.env.DATABASE_URL = 'postgresql://pooled.example.test/fintrack?sslmode=require';
    process.env.DIRECT_URL = 'postgresql://direct.example.test/fintrack?sslmode=require';
    const { default: config } = await import('../apps/api/prisma.config.mjs?direct');
    assert.equal(config.datasource.url, process.env.DIRECT_URL);
    assert.match(process.env.DATABASE_URL, /pooled.example.test/);
    delete process.env.DIRECT_URL;
    const { default: fallback } = await import('../apps/api/prisma.config.mjs?fallback');
    assert.equal(fallback.datasource.url, process.env.DATABASE_URL);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('production migration tooling requires TLS before spawning Prisma', () => {
  for (const command of ['migrate', 'status']) {
    const environment = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://db.example.test/db?sslmode=require',
    };
    assert.doesNotThrow(() => databaseEnvironment(command, environment));
    assert.throws(
      () =>
        databaseEnvironment(command, {
          ...environment,
          DIRECT_URL: 'postgresql://db.example.test/db',
        }),
      /require.*TLS/,
    );
    assert.throws(
      () => databaseEnvironment(command, { ...environment, DIRECT_URL: 'invalid-secret' }),
      (error) => !String(error).includes('invalid-secret'),
    );
  }
  assert.ok(databaseEnvironment('generate', {}).DATABASE_URL);
  assert.throws(() => databaseEnvironment('migrate', {}), /required/);
});
