import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, realpathSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { Writable } from 'node:stream';
import { recoverySession, recoverySql } from '../../scripts/recover-postgres-admin.mjs';

// No fallback to installed services, personal databases or .env credentials.
const data = realpathSync(process.env.FINTRACK_RECOVERY_TEST_DATA || 'missing-test-target');
const port = process.env.FINTRACK_RECOVERY_TEST_PORT;
assert.equal(process.platform, 'win32');
assert.equal(port, '55432');
assert.ok(data.startsWith(realpathSync(resolve('.local')) + sep + 'acceptance-postgres17-'));
assert.equal(readFileSync(join(data, 'PG_VERSION'), 'utf8').trim(), '17');
assert.equal(readFileSync(join(data, 'postmaster.pid'), 'utf8').split(/\r?\n/)[3], port);

const psql = 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe';
const hba = join(data, 'pg_hba.conf');
const args = [
  '-X',
  '-h',
  '127.0.0.1',
  '-p',
  port,
  '-U',
  'postgres',
  '-d',
  'postgres',
  '-w',
  '-v',
  'ON_ERROR_STOP=1',
];

function fixture() {
  const directory = mkdtempSync(join(data, 'recovery with spaces-'));
  const original = readFileSync(hba);
  const state = {
    hba,
    backup: join(directory, 'original HBA.conf'),
    sha256: createHash('sha256').update(original).digest('hex'),
    restored: join(directory, 'restored.txt'),
  };
  const statePath = join(directory, 'recovery state.json');
  writeFileSync(state.backup, original);
  writeFileSync(statePath, JSON.stringify(state));
  const sql = join(directory, 'recover command.sql');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key)));
  Object.assign(env, {
    PGCONNECT_TIMEOUT: '5',
    PGPASSFILE: join(directory, 'missing-password-file'),
    PSQL_HISTORY: 'NUL',
  });
  let output = '';
  const sink = new Writable({
    write(chunk, _encoding, done) {
      output += chunk.toString();
      done();
    },
  });
  return { state, statePath, sql, env, original, sink, output: () => output };
}

test('real psql reproduces the old Windows shell quoting failure and fails closed', async () => {
  const f = fixture();
  const script = resolve('scripts/recover-postgres-admin.mjs');
  writeFileSync(
    f.sql,
    [
      `\\! ""${process.execPath}" "${script}" --restore "${f.statePath}""`,
      '\\if :SHELL_ERROR',
      'SELECT 1 / 0;',
      '\\endif',
      "SELECT 'MUST_NOT_RUN';",
      '',
    ].join('\n'),
  );
  const result = await recoverySession({
    psql,
    args: [...args, '-f', f.sql],
    env: f.env,
    statePath: f.statePath,
    output: f.sink,
  });
  assert.equal(result.status, 3);
  assert.equal(result.restored, false);
  assert.ok(!f.output().includes('MUST_NOT_RUN'));
  assert.deepEqual(readFileSync(hba), f.original);
});

test('real psql launches from Program Files and verifies HBA restoration before the next command', async () => {
  const f = fixture();
  writeFileSync(f.sql, recoverySql(f.state.sha256));
  const result = await recoverySession({
    psql,
    args: [...args, '-f', f.sql, '-c', "SELECT 'AFTER_RESTORE_OK';"],
    env: f.env,
    statePath: f.statePath,
    output: f.sink,
  });
  assert.equal(result.status, 0);
  assert.equal(result.restored, true);
  assert.ok(f.output().includes('AFTER_RESTORE_OK'));
  assert.deepEqual(readFileSync(hba), f.original);
  // A fresh passwordless connection must fail again after restoring SCRAM.
  const unauthenticated = spawnSync(psql, [...args, '-c', 'SELECT 1;'], {
    env: f.env,
    shell: false,
    windowsHide: true,
    encoding: 'utf8',
  });
  assert.equal(unauthenticated.status, 2);
});

test('real PostgreSQL refuses a mismatched HBA checksum before subsequent commands', async () => {
  const f = fixture();
  writeFileSync(f.sql, recoverySql('0'.repeat(64)));
  const result = await recoverySession({
    psql,
    args: [...args, '-f', f.sql, '-c', "SELECT 'MUST_NOT_RUN';"],
    env: f.env,
    statePath: f.statePath,
    output: f.sink,
  });
  assert.equal(result.status, 3);
  assert.ok(!f.output().includes('MUST_NOT_RUN'));
  assert.deepEqual(readFileSync(hba), f.original);
});

test('failure to launch a Windows executable still restores the original HBA', async () => {
  const f = fixture();
  await assert.rejects(
    recoverySession({
      psql: join(data, 'missing binary.exe'),
      args,
      env: f.env,
      statePath: f.statePath,
      output: f.sink,
    }),
    { code: 'ENOENT' },
  );
  assert.deepEqual(readFileSync(hba), f.original);
});
