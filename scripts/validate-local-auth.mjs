// Explicit smoke test for an already migrated local development database.
// It retains all synthetic records and never resets, migrates or deletes data.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect } from '@playwright/test';
import pg from 'pg';
import { loadEnvironment } from './doctor.mjs';

const { values } = parseArgs({
  options: {
    api: { type: 'string' },
    web: { type: 'string' },
    'keep-synthetic-data': { type: 'boolean' },
  },
});
if (!values['keep-synthetic-data'])
  throw new Error(
    'Pass --keep-synthetic-data to retain synthetic records in the local development database.',
  );
const api = new URL(values.api ?? 'http://127.0.0.1:3000/v1');
const web = new URL(values.web ?? 'http://localhost:8081');
for (const url of [api, web]) {
  if (
    url.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error('This validation only supports local development HTTP services.');
}
loadEnvironment();
const target = new URL(process.env.DATABASE_URL);
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(target.hostname) ||
  target.pathname !== '/fintrack'
)
  throw new Error('Refusing a non-local development database.');
const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
const checks = [];
const record = (name) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
let browser;
let peerToken;
const email = `communication-${randomUUID()}@example.test`;
const peerEmail = `communication-peer-${randomUUID()}@example.test`;
const password = `synthetic-only-${randomUUID()}`;
let ownerId;
try {
  await db.connect();
  assert.equal(
    (await db.query("SELECT current_setting('server_version_num')::int AS version")).rows[0]
      .version >= 170000,
    true,
  );
  const root = api.href.replace(/\/$/, '');
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      ready = (await fetch(`${root}/health/ready`, { signal: AbortSignal.timeout(1000) })).ok;
    } catch {
      /* startup retry */
    }
    if (ready) break;
    await delay(200);
  }
  assert.ok(ready, 'The local API must be ready before validation.');
  for (const origin of [
    'http://localhost:8081',
    'http://localhost:8082',
    'http://localhost:8083',
    web.origin,
  ]) {
    const preflight = await fetch(`${root}/auth/register`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization,idempotency-key',
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
  }
  const denied = await fetch(`${root}/auth/register`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://untrusted.example', 'Access-Control-Request-Method': 'POST' },
  });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
  record('CORS preflight: 8081/8082/8083/current port authorized; external origin denied');
  const post = (path, body, token) =>
    fetch(`${root}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  for (const input of [
    { email: 'invalid', password },
    { email, password: 'short' },
  ])
    assert.equal((await post('/auth/register', input)).status, 400);
  record('API rejects invalid email and short password');
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const requests = [];
  let latestToken;
  page.on('request', (request) => {
    if (request.url().includes('/v1/')) {
      requests.push(new URL(request.url()).pathname);
      const authorization = request.headers().authorization;
      if (authorization?.startsWith('Bearer ')) latestToken = authorization.slice(7);
    }
  });
  await page.goto(`${web.origin}/login`);
  await expect(page.getByRole('button', { name: 'Criar minha conta', exact: true })).toBeVisible();
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByLabel('Confirmar senha', { exact: true }).fill('mismatch');
  await expect(page.getByRole('button', { name: 'Criar minha conta', exact: true })).toBeDisabled();
  record('frontend blocks mismatched password confirmation');
  await page.getByLabel('Confirmar senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Criar minha conta', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Cadastre sua primeira conta', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/accounts$/);
  const stored = await db.query('SELECT id, "passwordHash" FROM "User" WHERE email = $1', [email]);
  assert.equal(stored.rowCount, 1);
  ownerId = stored.rows[0].id;
  assert.equal(stored.rows[0].passwordHash.startsWith('scrypt$'), true);
  const clock = await db.query(
    'SELECT extract(epoch FROM "createdAt")::float8 AS epoch FROM "Session" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 1',
    [ownerId],
  );
  assert.ok(
    Math.abs(clock.rows[0].epoch * 1000 - Date.now()) < 10000,
    'Session timestamp must match the actual instant in PostgreSQL',
  );
  assert.equal(
    (await db.query('SELECT count(*)::int AS count FROM "Account" WHERE "userId" = $1', [ownerId]))
      .rows[0].count,
    0,
  );
  const cookie = (await context.cookies()).find((cookie) => cookie.name === 'fintrack_refresh');
  assert.ok(cookie?.httpOnly);
  assert.equal(cookie.sameSite, 'Strict');
  assert.equal(
    await page.evaluate(() => Object.keys(localStorage).some((key) => /auth|session/.test(key))),
    false,
  );
  record(
    'browser registration persists a password hash, redirects and starts with empty real accounts',
  );
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Cadastre sua primeira conta', exact: true }),
  ).toBeVisible();
  record('page reload restores the HttpOnly cookie session');
  assert.equal((await fetch(`${root}/auth/me`)).status, 401);
  await page.getByLabel('Nome da conta', { exact: true }).fill('Conta sintética comunicação');
  await page.getByLabel('Saldo inicial (R$)', { exact: true }).fill('1000');
  await page.getByRole('button', { name: 'Salvar conta', exact: true }).click();
  await expect(page.getByText('Conta salva no servidor.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir dashboard', exact: true }).click();
  await expect(page.getByLabel('Saldo disponível', { exact: true })).toContainText('1.000,00');
  for (const [kind, description, amount, category] of [
    ['+ Receita', 'Receita sintética comunicação', '500', 'Receita sintética'],
    ['− Despesa', 'Despesa sintética comunicação', '200', 'Despesa sintética'],
  ]) {
    await page.getByRole('button', { name: 'Nova receita ou despesa', exact: true }).click();
    await page.getByRole('radio', { name: kind, exact: true }).click();
    await page.getByLabel('Nova categoria', { exact: true }).fill(category);
    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith('/v1/categories') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Criar categoria', exact: true }).click();
    assert.equal((await created).status(), 201);
    await page.getByLabel('Descrição', { exact: true }).fill(description);
    await page.getByLabel('Valor (R$)', { exact: true }).fill(amount);
    await page.getByRole('button', { name: 'Salvar lançamento', exact: true }).click();
    await expect(page.getByText('Lançamento salvo no servidor.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir dashboard', exact: true }).click();
  }
  await expect(page.getByLabel('Saldo disponível', { exact: true })).toContainText('1.300,00');
  assert.equal(
    (
      await db.query('SELECT count(*)::int AS count FROM "Transaction" WHERE "userId"=$1', [
        ownerId,
      ])
    ).rows[0].count,
    2,
  );
  assert.equal(
    (await db.query('SELECT count(*)::int AS count FROM "Category" WHERE "userId"=$1', [ownerId]))
      .rows[0].count,
    2,
  );
  record('real account, categories, income and expense persist; dashboard balance is R$ 1,300.00');
  const identity = await fetch(`${root}/auth/me`, {
    headers: { Authorization: `Bearer ${latestToken}` },
  });
  assert.equal(identity.status, 200);
  assert.deepEqual(await identity.json(), { id: ownerId, email });
  const transactions = await fetch(`${root}/transactions`, {
    headers: { Authorization: `Bearer ${latestToken}` },
  });
  assert.equal((await transactions.json()).length, 2);
  record('identity and financial history require an active authenticated session');
  await db.query(
    'UPDATE "Session" SET "accessExpiresAt" = now() - interval \'1 second\' WHERE "userId"=$1 AND "revokedAt" IS NULL',
    [ownerId],
  );
  const refresh = page.waitForResponse((response) => response.url().endsWith('/v1/auth/refresh'));
  await page.getByRole('button', { name: 'Minhas contas', exact: true }).click();
  assert.equal((await refresh).status(), 200);
  await expect(
    page.getByRole('heading', { name: 'Conta sintética comunicação', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Editar nome', exact: true }).click();
  await page.getByLabel('Novo nome da conta', { exact: true }).fill('Conta sintética atualizada');
  await page.getByRole('button', { name: 'Salvar nome', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Conta sintética atualizada', exact: true }),
  ).toBeVisible();
  assert.equal(
    (await db.query('SELECT name FROM "Account" WHERE "userId"=$1', [ownerId])).rows[0].name,
    'Conta sintética atualizada',
  );
  record('account updates persist without changing the financial balance');
  await page.getByRole('button', { name: 'Abrir dashboard', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Saldo disponível', { exact: true })).toContainText('1.300,00');
  record('expired access renews through refresh; finance survives page reload');
  assert.equal((await post('/auth/register', { email, password })).status, 409);
  assert.equal(
    (await post('/auth/login', { email, password: `${password}-wrong`, deviceName: 'synthetic' }))
      .status,
    401,
  );
  record('duplicate email and incorrect login are rejected');
  assert.equal(
    (
      await post('/auth/login', {
        email: `missing-${randomUUID()}@example.test`,
        password,
        deviceName: 'synthetic',
      })
    ).status,
    401,
  );
  const revokedToken = latestToken;
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Criar minha conta', exact: true })).toBeVisible();
  assert.equal(
    (await context.cookies()).some((cookie) => cookie.name === 'fintrack_refresh'),
    false,
  );
  assert.equal(
    (await fetch(`${root}/accounts`, { headers: { Authorization: `Bearer ${revokedToken}` } }))
      .status,
    401,
  );
  await page.goto(`${web.origin}/accounts`);
  await expect(page.getByRole('button', { name: 'Criar minha conta', exact: true })).toBeVisible();
  record('logout revokes server session, clears cookie and protects private routes');
  await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).click();
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(`${password}-wrong`);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByText('E-mail ou senha incorretos.', { exact: true })).toBeVisible();
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByLabel('Saldo disponível', { exact: true })).toContainText('1.300,00');
  record(
    'browser login restores persisted financial records and displays specific invalid-credential errors',
  );
  assert.equal((await post('/auth/register', { email: peerEmail, password })).status, 201);
  const peerLogin = await post('/auth/login', {
    email: peerEmail,
    password,
    deviceName: 'synthetic peer',
  });
  assert.equal(peerLogin.status, 200);
  peerToken = (await peerLogin.json()).accessToken;
  for (const path of ['/accounts', '/categories', '/transactions']) {
    const response = await fetch(`${root}${path}`, {
      headers: { Authorization: `Bearer ${peerToken}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
  }
  const accountId = (await db.query('SELECT id FROM "Account" WHERE "userId"=$1', [ownerId]))
    .rows[0].id;
  const forbidden = await fetch(`${root}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${peerToken}`,
      'Idempotency-Key': randomUUID(),
    },
    body: JSON.stringify({
      accountId,
      kind: 'expense',
      description: 'Denied cross-user write',
      amountCents: '1',
      date: new Date().toISOString().slice(0, 10),
    }),
  });
  assert.equal(forbidden.status, 400);
  record('second user cannot list or write the first user financial records');
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Criar minha conta', exact: true })).toBeVisible();
  await page.route('**/v1/auth/login', (route) => route.abort('connectionrefused'));
  await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).click();
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(
    page.getByText('Não foi possível acessar a API. Confira a conexão e tente novamente.', {
      exact: true,
    }),
  ).toBeVisible();
  record('browser shows the connection error only when the connection actually fails');
  assert.ok(
    requests.includes('/v1/auth/register') &&
      requests.includes('/v1/accounts') &&
      requests.includes('/v1/transactions'),
  );
  console.log(
    JSON.stringify({
      result: 'passed',
      api: root,
      web: web.origin,
      checks: checks.length,
      syntheticUsersRetained: [email, peerEmail],
    }),
  );
} catch (error) {
  // Database errors can contain complete rows, token hashes or SQL. Never print them.
  console.error(
    `Local validation failed after ${checks.length} checks (${error.code ?? error.name ?? 'unknown'}).`,
  );
  if (error.name === 'AssertionError')
    console.error('A validation assertion did not match the observed behavior.');
  process.exitCode = 1;
} finally {
  if (peerToken)
    await fetch(`${api.href.replace(/\/$/, '')}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${peerToken}` },
    }).catch(() => {});
  await browser?.close();
  await db.end().catch(() => {});
}
