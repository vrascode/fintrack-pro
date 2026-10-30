import pg from 'pg';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';

// Run locally: passwords are read from the terminal and never written to disk.
if (!process.stdin.isTTY) throw new Error('Run this command in your local interactive terminal.');
process.loadEnvFile('.env');
const identifier = (value) => `"${value.replaceAll('"', '""')}"`;
const literal = (value) => `'${value.replaceAll("'", "''")}'`;

async function password(prompt) {
  process.stdout.write(prompt);
  const muted = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  const reader = createInterface({ input: process.stdin, output: muted, terminal: true });
  try {
    return await new Promise((resolve) => reader.question('', resolve));
  } finally {
    reader.close();
    process.stdout.write('\n');
  }
}

for (const name of ['DATABASE_URL', 'TEST_DATABASE_URL']) {
  const target = new URL(process.env[name]);
  const database = target.pathname.slice(1);
  const role = decodeURIComponent(target.username);
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
    !/^fintrack(?:_test)?$/.test(database) ||
    !/^fintrack(?:_test)?$/.test(role)
  ) {
    throw new Error('Only the local fintrack and fintrack_test databases are supported.');
  }
  const adminPassword = await password(`PostgreSQL admin (postgres), port ${target.port}: `);
  const admin = new pg.Client({
    host: target.hostname,
    port: Number(target.port),
    database: 'postgres',
    user: 'postgres',
    password: adminPassword,
    connectionTimeoutMillis: 5000,
  });
  try {
    await admin.connect();
    const existingRole = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
    if (!existingRole.rowCount) {
      await admin.query(
        `CREATE ROLE ${identifier(role)} LOGIN PASSWORD ${literal(decodeURIComponent(target.password))}`,
      );
    }
    const existingDatabase = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      database,
    ]);
    if (!existingDatabase.rowCount) {
      await admin.query(`CREATE DATABASE ${identifier(database)} OWNER ${identifier(role)}`);
    }
    const application = new pg.Client({
      connectionString: target.toString(),
      connectionTimeoutMillis: 5000,
    });
    try {
      await application.connect();
      await application.query('SELECT 1');
      console.log(
        `${name}: role and database ready on port ${target.port}. Existing records preserved.`,
      );
    } finally {
      await application.end().catch(() => {});
    }
  } catch (error) {
    console.error(
      `${name}: setup failed (${error.code ?? 'connection error'}). Existing role passwords are never changed. Check your local .env and admin password.`,
    );
    process.exitCode = 1;
    break;
  } finally {
    await admin.end().catch(() => {});
  }
}
