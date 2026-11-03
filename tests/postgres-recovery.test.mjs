import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
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

test('psql checks the effective HBA checksum and refuses restoration failure without a shell', () => {
  const hash = createHash('sha256').update('original HBA').digest('hex');
  const sql = recoverySql(hash);
  assert.match(sql, /^\\echo FINTRACK_RECOVERY_CONNECTED/);
  assert.match(sql, /sha256\(pg_read_binary_file\(current_setting\('hba_file'\)\)\)/);
  assert.ok(sql.includes(hash));
  assert.match(sql, /RAISE EXCEPTION 'Original HBA was not restored; password reset refused'/);
  assert.ok(!sql.includes('\\!'));
  assert.ok(!sql.includes('\\password'));
  assert.throws(() => recoverySql("hash'; SELECT 1;"), /checksum/);
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
    restoreHba(path);
    assert.deepEqual(readFileSync(state.hba), original);
    writeFileSync(state.backup, 'corrupt');
    assert.throws(() => restoreHba(path), /checksum/);
    assert.deepEqual(readFileSync(state.hba), original);
  } finally {
    rmSync(directory, { recursive: true });
  }
});
