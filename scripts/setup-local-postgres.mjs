import pg from 'pg';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const identifier = (value) => `"${value.replaceAll('"', '""')}"`;
const literal = (value) => `'${value.replaceAll("'", "''")}'`;

export function setupOptions(args) {
  const targets = args.filter((arg) => ['--development', '--test'].includes(arg));
  if (
    targets.length !== 1 ||
    args.some(
      (arg) => !['--development', '--test', '--inspect', '--reconcile-password'].includes(arg),
    )
  ) {
    throw new Error(
      'Select exactly one target: --development OR --test. Optional: --inspect, --reconcile-password.',
    );
  }
  return {
    test: targets[0] === '--test',
    inspect: args.includes('--inspect'),
    reconcile: args.includes('--reconcile-password'),
  };
}

export function setupTarget(options, env) {
  const key = options.test ? 'TEST_DATABASE_URL' : 'DATABASE_URL';
  const expected = options.test ? 'fintrack_test' : 'fintrack';
  let url;
  try {
    url = new URL(env[key]);
  } catch {
    throw new Error(`${key} is missing or invalid. Edit the ignored local .env.`);
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.pathname !== `/${expected}` ||
    decodeURIComponent(url.username) !== expected ||
    url.search ||
    url.hash ||
    !url.password
  ) {
    throw new Error(
      `${key} must name the local ${expected} database and role, with a password and no URL options.`,
    );
  }
  return {
    key,
    role: expected,
    database: expected,
    host: url.hostname.replace(/^\[|\]$/g, ''),
    port: Number(url.port || 5432),
    url,
  };
}

export function safeTarget(target) {
  return {
    variable: target.key,
    host: target.host,
    port: target.port,
    database: target.database,
    role: target.role,
    passwordConfigured: !!target.url.password,
  };
}

// Local generated application credentials are printable ASCII (SASLprep is a no-op).
// Send only the PostgreSQL SCRAM verifier to DDL, never the plaintext password.
export function scramVerifier(password, salt = randomBytes(16)) {
  if (!/^[\x21-\x7e]{16,}$/.test(password)) {
    throw new Error(
      'Local provisioning requires an application password of at least 16 printable ASCII characters without spaces. Update only the ignored .env.',
    );
  }
  const salted = pbkdf2Sync(password, salt, 4096, 32, 'sha256');
  const hmac = (text) => createHmac('sha256', salted).update(text).digest();
  const stored = createHash('sha256').update(hmac('Client Key')).digest('base64');
  const server = hmac('Server Key').toString('base64');
  salted.fill(0);
  return `SCRAM-SHA-256$4096:${salt.toString('base64')}$${stored}:${server}`;
}

async function password(prompt) {
  process.stdout.write(prompt);
  const muted = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  const reader = createInterface({ input: process.stdin, output: muted, terminal: true });
  try {
    return await new Promise((resolvePassword, reject) => {
      reader.once('SIGINT', () => reject(new Error('Password entry cancelled.')));
      reader.once('close', () => reject(new Error('Password entry cancelled.')));
      reader.question('', resolvePassword);
    });
  } finally {
    reader.close();
    process.stdout.write('\n');
  }
}

export async function provision(admin, target, { reconcile = false } = {}) {
  const role = identifier(target.role);
  const database = identifier(target.database);
  const existing = await admin.query(
    'SELECT oid, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = $1',
    [target.role],
  );
  const databases = await admin.query(
    'SELECT oid, pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = $1',
    [target.database],
  );
  if (databases.rowCount && databases.rows[0].owner !== target.role) {
    throw new Error(
      'The existing database has a different owner. No ownership or password was changed.',
    );
  }
  if (existing.rowCount) {
    const flags = existing.rows[0];
    if (
      ['rolsuper', 'rolcreatedb', 'rolcreaterole', 'rolreplication', 'rolbypassrls'].some(
        (key) => flags[key],
      )
    ) {
      throw new Error(
        'The existing application role has elevated privileges. Refusing to reuse or modify it.',
      );
    }
    if (reconcile) {
      const shared = await admin.query(
        `SELECT 1 FROM pg_database WHERE datdba = $1 AND datname <> $2
        UNION ALL SELECT 1 FROM pg_auth_members WHERE member = $1 OR roleid = $1
        UNION ALL SELECT 1 FROM pg_shdepend WHERE refclassid = 'pg_authid'::regclass
          AND refobjid = $1 AND dbid <> 0 AND dbid <> $3 LIMIT 1`,
        [flags.oid, target.database, databases.rows[0]?.oid ?? 0],
      );
      if (shared.rowCount)
        throw new Error(
          'This role is shared with other databases or roles. Password reconciliation refused.',
        );
    }
  }
  if (!existing.rowCount || reconcile) {
    const verifier = scramVerifier(decodeURIComponent(target.url.password));
    await admin.query(
      !existing.rowCount
        ? `CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${literal(verifier)}`
        : `ALTER ROLE ${role} LOGIN PASSWORD ${literal(verifier)}`,
    );
  }
  if (!databases.rowCount) await admin.query(`CREATE DATABASE ${database} OWNER ${role}`);
}

async function main() {
  const options = setupOptions(process.argv.slice(2));
  process.loadEnvFile(resolve(root, '.env'));
  const target = setupTarget(options, process.env);
  console.log(safeTarget(target));
  if (options.inspect) return;
  if (!process.stdin.isTTY) throw new Error('Run this command in your own interactive terminal.');
  const admin = new pg.Client({
    host: target.host,
    port: target.port,
    database: 'postgres',
    user: 'postgres',
    password: await password(`PostgreSQL admin password for port ${target.port} (hidden): `),
    connectionTimeoutMillis: 5000,
  });
  try {
    await admin.connect();
    const identity = await admin.query('SELECT version() AS version, inet_server_port() AS port');
    if (identity.rows[0].port !== target.port)
      throw new Error('The server port differs from the selected configuration.');
    console.log(identity.rows[0]);
    if (options.reconcile)
      console.log(
        `Explicit reconciliation: only ${target.role} will adopt its local .env password.`,
      );
    await provision(admin, target, options);
    const application = new pg.Client({
      connectionString: target.url.href,
      connectionTimeoutMillis: 5000,
    });
    try {
      await application.connect();
      await application.query('BEGIN');
      await application.query(
        'CREATE TEMP TABLE fintrack_setup_probe (value integer) ON COMMIT DROP',
      );
      await application.query('INSERT INTO fintrack_setup_probe VALUES (1)');
      const read = await application.query('SELECT value FROM fintrack_setup_probe');
      if (read.rows[0]?.value !== 1) throw new Error('Application SQL write/read did not match.');
      await application.query('ROLLBACK');
      console.log(
        `${target.key}: application authentication and temporary SQL write/read passed. Existing records preserved; migrations and persistence acceptance remain separate.`,
      );
    } finally {
      await application.end().catch(() => {});
    }
  } finally {
    await admin.end().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    // Database errors can include query text. Never print them or connection URLs.
    console.error(
      error.code
        ? `Setup stopped (${error.code}). No retry performed. Check the selected local credentials; use --reconcile-password only for the dedicated FinTrack role.`
        : error.message,
    );
    process.exitCode = 1;
  }
}
