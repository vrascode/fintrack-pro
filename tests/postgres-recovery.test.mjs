import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { recoveryHba, recoverySql, restoreHba } from '../scripts/recover-postgres-admin.mjs';

test('temporary HBA grants only postgres/postgres on IPv4 loopback and retains all original bytes', () => {
  const original = Buffer.from('# original\r\nhost all all 127.0.0.1/32 scram-sha-256\r\n');
  const temporary = recoveryHba(original);
  assert.equal(temporary.toString().split('\r\n')[1], 'host postgres postgres 127.0.0.1/32 trust');
  assert.ok(temporary.subarray(-original.length).equals(original));
  assert.throws(() => recoveryHba(temporary), /earlier recovery/);
});

test('psql restores HBA before hidden password entry and stops on restoration failure', () => {
  const sql = recoverySql('C:\\workspace\\state.json', 'C:\\node\\node.exe');
  assert.ok(sql.indexOf('--restore') < sql.indexOf('\\password postgres'));
  assert.match(sql, /\\if :SHELL_ERROR\nSELECT 1 \/ 0;/);
  assert.match(sql, /password_encryption = 'scram-sha-256'/);
  assert.throws(() => recoverySql('C:\\path%USERNAME%\\state.json'), /Unsupported/);
});

test('restoration is byte-exact, idempotent after an error, and rejects a corrupt backup', () => {
  mkdirSync(resolve('.local'), { recursive: true });
  const directory = mkdtempSync(resolve('.local/recovery-test-'));
  try {
    const original = Buffer.from(
      '# configuração original\r\nhost all all ::1/128 scram-sha-256\r\n',
    );
    const state = {
      hba: join(directory, 'hba'),
      backup: join(directory, 'backup'),
      restored: join(directory, 'restored'),
      sha256: createHash('sha256').update(original).digest('hex'),
    };
    const path = join(directory, 'state.json');
    writeFileSync(path, JSON.stringify(state));
    writeFileSync(state.backup, original);
    writeFileSync(state.hba, recoveryHba(original));
    try {
      throw new Error('psql failed');
    } catch {
      restoreHba(path);
    }
    assert.deepEqual(readFileSync(state.hba), original);
    if (process.platform === 'win32') {
      writeFileSync(state.hba, recoveryHba(original));
      const command = recoverySql(path).split('\n')[0].slice(3);
      const child = spawnSync(process.env.ComSpec, ['/d', '/s', '/c', command], {
        windowsVerbatimArguments: true,
        windowsHide: true,
        encoding: 'utf8',
      });
      assert.equal(child.status, 0, child.stderr);
      assert.deepEqual(readFileSync(state.hba), original);
    }
    restoreHba(path);
    assert.deepEqual(readFileSync(state.hba), original);
    writeFileSync(state.backup, 'corrupt');
    assert.throws(() => restoreHba(path), /checksum/);
    assert.deepEqual(readFileSync(state.hba), original);
  } finally {
    rmSync(directory, { recursive: true });
  }
});
