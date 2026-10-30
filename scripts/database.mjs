import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const api = fileURLToPath(new URL('../apps/api/', import.meta.url));
const requireApi = createRequire(new URL('../apps/api/package.json', import.meta.url));

// Tests create and delete records. Never fall back to DATABASE_URL.
export function validateTestDatabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('TEST_DATABASE_URL must be an explicit PostgreSQL test connection.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/^\/[a-z][a-z0-9_]*_test$/.test(url.pathname) ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'Integration requires a loopback database ending in _test, without URL options.',
    );
  }
  return url.href;
}

function run(args, cwd, env) {
  const result = spawnSync(process.execPath, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw new Error('Unable to start the database command.');
  if (result.status !== 0) throw new Error('Database command failed; acceptance remains pending.');
}

export function main(command) {
  if (existsSync(resolve(root, '.env'))) loadEnvFile(resolve(root, '.env'));
  const commands = {
    validate: ['validate'],
    generate: ['generate'],
    migrate: ['migrate', 'deploy'],
    status: ['migrate', 'status'],
  };
  if (command !== 'test' && !Object.hasOwn(commands, command)) {
    throw new Error('Use validate, generate, migrate, status or test.');
  }
  const env = { ...process.env };
  if (command === 'test') env.DATABASE_URL = validateTestDatabaseUrl(env.TEST_DATABASE_URL);
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required; see DATABASE.md.');
  let cli;
  try {
    // Prisma 7 exposes its executable through this explicit package subpath.
    // Resolving the package root can select its TypeScript declaration shim.
    cli = requireApi.resolve('prisma/build/index.js');
    requireApi.resolve('@prisma/client');
    requireApi.resolve('@prisma/adapter-pg');
  } catch {
    throw new Error(
      'Prisma dependencies are not installed. Follow DATABASE.md; no database check ran.',
    );
  }
  if (command === 'test') {
    run([cli, 'validate'], api, env);
    run([cli, 'generate'], api, env);
    run([cli, 'migrate', 'deploy'], api, env);
    // Reapplying must be a no-op. No reset, db push, or destructive schema operations.
    run([cli, 'migrate', 'deploy'], api, env);
    run([cli, 'migrate', 'status'], api, env);
    run(
      [
        '--import',
        'tsx',
        '--test',
        'tests/integration/identity.test.mjs',
        'tests/integration/ledger.test.mjs',
      ],
      root,
      env,
    );
    return;
  }
  run([cli, ...commands[command]], api, env);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
