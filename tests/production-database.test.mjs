import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabaseAdapter } from '../apps/api/dist/database/adapter.js';

test('invalid database URLs never include the secret input in startup errors', () => {
  assert.throws(
    () => createDatabaseAdapter('postgresql://user:private-password@bad host/db'),
    (error) => {
      assert.match(error.message, /DATABASE_URL/);
      assert.doesNotMatch(
        JSON.stringify(error, Object.getOwnPropertyNames(error)),
        /private-password/,
      );
      return true;
    },
  );
});

test('production database adapter requires PostgreSQL TLS before connecting', () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    assert.throws(
      () => createDatabaseAdapter('postgresql://user:pass@db.example.test/fintrack'),
      /requires TLS/,
    );
    assert.throws(
      () =>
        createDatabaseAdapter('postgresql://user:pass@db.example.test/fintrack?sslmode=disable'),
      /requires TLS/,
    );
    assert.doesNotThrow(() =>
      createDatabaseAdapter('postgresql://user:pass@db.example.test/fintrack?sslmode=require'),
    );
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
