// Real PostgreSQL acceptance without touching installed services or local .env.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { provision, setupTarget } from './setup-local-postgres.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const bin = 'C:\\Program Files\\PostgreSQL\\17\\bin';
const port = 55432;
const pgEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key)));

async function run() {
  if (process.platform !== 'win32')
    throw new Error('This local acceptance helper requires Windows PostgreSQL 17 binaries.');
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', resolve);
  });
  await new Promise((resolve) => probe.close(resolve));
  mkdirSync(join(root, '.local'), { recursive: true });
  const directory = mkdtempSync(join(root, '.local', 'acceptance-postgres17-'));
  const data = join(directory, 'data');
  const adminPassword = randomBytes(32).toString('hex');
  const appPassword = randomBytes(32).toString('hex');
  const url = `postgresql://fintrack_test:${appPassword}@127.0.0.1:${port}/fintrack_test`;
  // initdb 17 on Windows does not treat --pwfile=- as stdin. A one-use named
  // pipe supplies the generated test password without writing it to disk.
  const pipeName = `\\\\.\\pipe\\fintrack-initdb-${randomBytes(12).toString('hex')}`;
  const passwordPipe = createServer((socket) => socket.end(`${adminPassword}\n`));
  await new Promise((resolve, reject) => {
    passwordPipe.once('error', reject);
    passwordPipe.listen(pipeName, resolve);
  });
  let init;
  try {
    init = await new Promise((resolveInit, reject) => {
      const child = spawn(
        join(bin, 'initdb.exe'),
        [
          '-D',
          data,
          '-U',
          'postgres',
          `--pwfile=${pipeName}`,
          '--auth=scram-sha-256',
          '--encoding=UTF8',
          '--locale=C',
          '--no-instructions',
        ],
        { cwd: root, env: pgEnv, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true },
      );
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.once('error', reject);
      child.once('exit', (status) => resolveInit({ status, stderr }));
    });
  } finally {
    await new Promise((resolve) => passwordPipe.close(resolve));
  }
  if (init.error || init.status !== 0) {
    const diagnostic =
      init.stderr?.toString().replaceAll(adminPassword, '[redacted]') || init.error?.code;
    throw new Error(`Isolated initdb failed; installed services were not modified. ${diagnostic}`);
  }
  const control = (args) =>
    spawnSync(join(bin, 'pg_ctl.exe'), ['-D', data, ...args], {
      cwd: root,
      env: pgEnv,
      stdio: 'ignore',
      windowsHide: true,
    });
  try {
    const start = control([
      '-l',
      join(directory, 'postgres.log'),
      '-o',
      `-p ${port} -h 127.0.0.1`,
      '-w',
      'start',
    ]);
    if (start.error || start.status !== 0) throw new Error('Isolated PostgreSQL did not start.');
    const admin = new pg.Client({
      host: '127.0.0.1',
      port,
      database: 'postgres',
      user: 'postgres',
      password: adminPassword,
      connectionTimeoutMillis: 5000,
    });
    try {
      await admin.connect();
      const identity = await admin.query('SELECT version() AS version, inet_server_port() AS port');
      console.log(identity.rows[0]);
      const target = setupTarget({ test: true }, { TEST_DATABASE_URL: url });
      await provision(admin, target);
      await provision(admin, target, { reconcile: true });
      const app = new pg.Client({ connectionString: url });
      try {
        await app.connect();
        const privileges = await app.query(
          'SELECT rolsuper FROM pg_roles WHERE rolname = current_user',
        );
        if (privileges.rows[0].rolsuper)
          throw new Error('Acceptance role must not be a superuser.');
        console.log(
          'Dedicated application role authenticated after explicit SCRAM reconciliation.',
        );
      } finally {
        await app.end();
      }
    } finally {
      await admin.end();
    }
    console.log(
      `Real acceptance uses a fresh PostgreSQL 17 cluster on ${port}. Services 5432/5433 and .env are unchanged.`,
    );
    const npm = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    const child = spawn(process.execPath, [npm, 'run', 'test:e2e:real'], {
      cwd: root,
      env: { ...process.env, TEST_DATABASE_URL: url },
      stdio: 'inherit',
      windowsHide: true,
    });
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });
    if (code !== 0) throw new Error(`Real PostgreSQL acceptance failed (exit ${code}).`);
  } finally {
    const stopped = control(['-m', 'fast', '-w', 'stop']);
    if (stopped.status !== 0) console.error(`Check the isolated cluster shutdown: ${data}`);
    else
      console.log(
        `Isolated cluster stopped; diagnostic files retained at ${directory}. No personal data deleted.`,
      );
  }
}

try {
  await run();
} catch (error) {
  console.error(error.code ? `Isolated acceptance stopped (${error.code}).` : error.message);
  process.exitCode = 1;
}
