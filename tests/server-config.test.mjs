import assert from 'node:assert/strict';
import test from 'node:test';
import { serverOptions } from '../apps/api/dist/config/server.js';

test('production listens externally on the provider port without requiring HOST', () => {
  const env = { NODE_ENV: 'production', DATABASE_URL: 'configured', PORT: '10000' };
  assert.deepEqual(serverOptions(env), { port: 10000, host: '0.0.0.0' });
  assert.deepEqual(serverOptions({ ...env, HOST: '' }), { port: 10000, host: '0.0.0.0' });
  assert.equal(serverOptions({ ...env, HOST: '::' }).host, '::');
  assert.deepEqual(serverOptions({}), { port: 3000, host: '127.0.0.1' });
});

test('startup rejects missing production database and invalid provider ports', () => {
  for (const DATABASE_URL of [undefined, '', '   '])
    assert.throws(() => serverOptions({ NODE_ENV: 'production', DATABASE_URL }), /DATABASE_URL/);
  for (const PORT of ['', 'NaN', '3.5', '0', '-1', '65536'])
    assert.throws(() => serverOptions({ PORT }), /PORT/);
});
