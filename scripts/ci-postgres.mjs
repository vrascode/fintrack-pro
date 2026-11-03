// CI-only disposable PostgreSQL provisioning. No local .env is read.
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { provision, setupTarget } from './setup-local-postgres.mjs';

if (!process.env.GITHUB_ACTIONS || !process.env.GITHUB_ENV || !process.env.CI_PG_ADMIN_PASSWORD)
  throw new Error('This helper requires the disposable GitHub Actions PostgreSQL service.');
const password = randomBytes(32).toString('hex');
console.log(`::add-mask::${password}`);
const url = `postgresql://fintrack_test:${password}@127.0.0.1:5433/fintrack_test`;
const admin = new pg.Client({
  host: '127.0.0.1',
  port: 5433,
  database: 'postgres',
  user: 'postgres',
  password: process.env.CI_PG_ADMIN_PASSWORD,
  connectionTimeoutMillis: 5000,
});
try {
  await admin.connect();
  await provision(admin, setupTarget({ test: true }, { TEST_DATABASE_URL: url }));
  appendFileSync(process.env.GITHUB_ENV, `TEST_DATABASE_URL=${url}\n`);
} finally {
  await admin.end();
}
