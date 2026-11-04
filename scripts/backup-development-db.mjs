import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
if (existsSync(join(root, '.env'))) loadEnvFile(join(root, '.env'));
const target = new URL(process.env.DATABASE_URL);
if (
  !['127.0.0.1', 'localhost'].includes(target.hostname) ||
  target.port !== '5432' ||
  target.pathname !== '/fintrack'
)
  throw new Error('Backup target must be the configured local development database.');
const password = decodeURIComponent(target.password);
target.password = '';
if (target.searchParams.get('schema') !== 'public' || target.searchParams.size !== 1)
  throw new Error('Unexpected database URL options.');
target.search = '';
const directory = join(root, '.local', 'backups');
mkdirSync(directory, { recursive: true });
const output = join(directory, `fintrack-${new Date().toISOString().replaceAll(':', '-')}.dump`);
const executable = 'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe';
const result = spawnSync(
  executable,
  ['--format=custom', '--file', output, '--dbname', target.href],
  {
    env: { ...process.env, PGPASSWORD: password },
    stdio: 'pipe',
    windowsHide: true,
  },
);
if (result.status !== 0)
  throw new Error(
    `pg_dump failed (${result.error?.code ?? result.status}): ${String(result.stderr).slice(0, 300)}. Migration must not run.`,
  );
const bytes = statSync(output).size;
if (bytes < 1000) throw new Error('Backup is unexpectedly small; migration must not run.');
const sha256 = createHash('sha256').update(readFileSync(output)).digest('hex');
console.log(`Backup: ${output}\nBytes: ${bytes}\nSHA256: ${sha256}`);
