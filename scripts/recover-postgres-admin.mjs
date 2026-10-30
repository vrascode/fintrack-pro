import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const script = fileURLToPath(import.meta.url);
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const bin = 'C:\\Program Files\\PostgreSQL\\17\\bin';
const data = 'C:\\Program Files\\PostgreSQL\\17\\data';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function recoveryHba(original) {
  if (original.toString('utf8').includes('# FinTrack temporary administrator recovery')) {
    throw new Error('An earlier recovery must be restored before starting another.');
  }
  return Buffer.concat([
    Buffer.from(
      '# FinTrack temporary administrator recovery\r\nhost postgres postgres 127.0.0.1/32 trust\r\n',
    ),
    original,
  ]);
}

export function restoreHba(statePath) {
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  const original = readFileSync(state.backup);
  if (digest(original) !== state.sha256) throw new Error('Recovery backup checksum mismatch.');
  // Write in place: do not replace the file or change its Windows ACL.
  if (!readFileSync(state.hba).equals(original)) writeFileSync(state.hba, original);
  if (!readFileSync(state.hba).equals(original)) throw new Error('HBA restoration failed.');
  writeFileSync(state.restored, 'Original HBA restored.\n');
}

function shellPath(value) {
  // psql's local shell command only contains these validated paths, never secrets.
  if (/["%!^&|<>\r\n]/.test(value)) throw new Error('Unsupported shell characters in path.');
  return `"${value}"`;
}

export function recoverySql(statePath, executable = process.execPath) {
  return [
    `\\! "${shellPath(executable)} ${shellPath(script)} --restore ${shellPath(statePath)}"`,
    '\\if :SHELL_ERROR',
    'SELECT 1 / 0; -- ON_ERROR_STOP: never change the password if restoration failed.',
    '\\endif',
    "SET password_encryption = 'scram-sha-256';",
    '\\password postgres',
    'SELECT current_user, inet_server_port();',
    '',
  ].join('\n');
}

function inspect() {
  if (process.platform !== 'win32') throw new Error('This recovery targets Windows PostgreSQL 17.');
  const service = JSON.parse(
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        'Get-CimInstance Win32_Service -Filter "Name=\'postgresql-x64-17\'" | Select-Object State,PathName | ConvertTo-Json -Compress',
      ],
      { encoding: 'utf8', windowsHide: true },
    ),
  );
  if (service?.State !== 'Running' || !service.PathName.includes(data)) {
    throw new Error('Expected running PostgreSQL 17 service and data directory were not found.');
  }
  const postgres = join(bin, 'postgres.exe');
  const setting = (name) =>
    execFileSync(postgres, ['-D', data, '-C', name], {
      encoding: 'utf8',
      windowsHide: true,
    }).trim();
  const pid = readFileSync(join(data, 'postmaster.pid'), 'utf8').split(/\r?\n/);
  const hba = resolve(setting('hba_file'));
  if (setting('port') !== '5432' || pid[3] !== '5432' || hba !== join(data, 'pg_hba.conf')) {
    throw new Error('Unexpected port or HBA path; automatic recovery refused.');
  }
  const listener = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      '(Get-NetTCPConnection -LocalPort 5432 -State Listen).OwningProcess | Select-Object -Unique',
    ],
    { encoding: 'utf8', windowsHide: true },
  ).trim();
  if (listener !== pid[0]) throw new Error('Port 5432 does not belong to this data directory.');
  return {
    service: 'postgresql-x64-17',
    version: execFileSync(postgres, ['--version'], {
      encoding: 'utf8',
      windowsHide: true,
    }).trim(),
    port: 5432,
    data,
    hba,
    pid: Number(pid[0]),
  };
}

async function watchdog(statePath, parentPid) {
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  process.send?.('ready');
  const deadline = Date.now() + 30000;
  while (!existsSync(state.restored)) {
    let alive = true;
    try {
      process.kill(parentPid, 0);
    } catch {
      alive = false;
    }
    if (!alive || Date.now() >= deadline) {
      restoreHba(statePath);
      break;
    }
    await delay(200);
  }
  process.disconnect?.();
}

async function recover() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      'Run node scripts/recover-postgres-admin.mjs in your own interactive terminal.',
    );
  }
  const instance = inspect();
  console.log(instance);
  const original = readFileSync(instance.hba);
  const temporary = recoveryHba(original);
  mkdirSync(join(root, '.local'), { recursive: true });
  const directory = mkdtempSync(join(root, '.local', 'postgres17-recovery-'));
  const statePath = join(directory, 'state.json');
  const state = {
    hba: instance.hba,
    backup: join(directory, 'pg_hba.conf.original'),
    sha256: digest(original),
    restored: join(directory, 'restored.txt'),
  };
  writeFileSync(state.backup, original, { flag: 'wx' });
  writeFileSync(statePath, JSON.stringify(state), { flag: 'wx' });
  const sql = join(directory, 'recover.sql');
  writeFileSync(sql, recoverySql(statePath), { flag: 'wx' });
  console.log(`Configuration backup: ${state.backup}`);

  // Independent guard restores authentication if this process is terminated or psql hangs.
  const guard = spawn(process.execPath, [script, '--watch', statePath, String(process.pid)], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    detached: true,
    windowsHide: true,
  });
  await new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => reject(new Error('Recovery watchdog did not start.')), 5000);
    guard.once('message', () => {
      clearTimeout(timer);
      resolveReady();
    });
    guard.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    guard.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Watchdog exited: ${code}`));
    });
  });
  guard.unref();
  guard.channel?.unref();
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key)));
  Object.assign(env, {
    PGCONNECT_TIMEOUT: '5',
    PGPASSFILE: join(directory, 'no-password-file'),
    PSQL_HISTORY: 'NUL',
  });
  const args = [
    '-X',
    '-h',
    '127.0.0.1',
    '-p',
    '5432',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
  ];
  let result;
  try {
    writeFileSync(instance.hba, temporary);
    // On Windows HBA changes apply to new connections immediately. The first psql
    // command restores the original bytes BEFORE its hidden password prompts.
    result = spawnSync(join(bin, 'psql.exe'), [...args, '-w', '-f', sql], {
      env,
      stdio: 'inherit',
    });
  } finally {
    restoreHba(statePath);
  }
  if (result.error || result.status !== 0)
    throw new Error('Password reset did not complete. Original HBA restored.');
  console.log(
    'Original authentication restored. Enter the NEW password once more to validate psql.',
  );
  const validation = spawnSync(
    join(bin, 'psql.exe'),
    [
      ...args,
      '-W',
      '-c',
      'SELECT current_user, current_database(), inet_server_port(), version();',
    ],
    { env, stdio: 'inherit' },
  );
  if (validation.error || validation.status !== 0)
    throw new Error('Password authentication not validated. Do not retry the old password.');
  console.log(
    'PostgreSQL 17 password authentication validated on 5432. Port 5433 was not changed.',
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const command = process.argv[2];
    if (command === '--inspect') console.log(inspect());
    else if (command === '--restore') restoreHba(process.argv[3]);
    else if (command === '--watch') await watchdog(process.argv[3], Number(process.argv[4]));
    else if (!command) await recover();
    else throw new Error('Use --inspect, or no arguments for interactive recovery.');
  } catch (error) {
    console.error(`Recovery stopped: ${error.message}`);
    process.exitCode = 1;
  }
}
