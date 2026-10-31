import pg from 'pg';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));

export function loadEnvironment() {
  if (existsSync(resolve(root, '.env'))) process.loadEnvFile(resolve(root, '.env'));
}

export async function checkDatabase(key = 'DATABASE_URL') {
  const value = process.env[key];
  let url;
  try {
    url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error(`${key}: missing or invalid PostgreSQL configuration. See DATABASE.md.`);
  }
  console.log(`${key}: ${url.hostname}:${url.port || '5432'}${url.pathname}`);
  const client = new pg.Client({ connectionString: value, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const result = await client.query('SELECT version() AS version');
    console.log(result.rows[0].version);
    await client.query(
      'SELECT 1 FROM "User", "Session", "Account", "Category", "Transaction" LIMIT 0',
    );
    console.log(`${key}: authentication and application tables ready.`);
  } catch (error) {
    const hint =
      error.code === '28P01'
        ? 'credentials rejected; configure the ignored .env or run the local provisioning helper'
        : error.code === '42P01'
          ? 'application tables missing; run npm.cmd run db:migrate'
          : 'connection failed; check service, port and credentials';
    throw new Error(`${key}: ${hint} (${error.code || 'unavailable'}).`, { cause: error });
  } finally {
    await client.end().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  loadEnvironment();
  for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL']) {
    try {
      await checkDatabase(key);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
