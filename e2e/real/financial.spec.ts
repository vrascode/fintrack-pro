import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { validateTestDatabaseUrl } from '../../scripts/database.mjs';

process.loadEnvFile('.env');
const databaseUrl = validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);
const api = 'http://localhost:3101/v1';
let server: ChildProcess | undefined;

async function startApi() {
  server = spawn(process.execPath, ['apps/api/dist/main.js'], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PORT: '3101',
      HOST: '127.0.0.1',
      NODE_ENV: 'development',
      CORS_ORIGINS: 'http://localhost:8082',
    },
    stdio: 'ignore',
    windowsHide: true,
  });
  for (let retry = 0; retry < 100; retry++) {
    if (server.exitCode !== null) throw new Error('The isolated test API exited.');
    try {
      if ((await fetch(`${api}/health/ready`)).ok) return;
    } catch {
      /* startup */
    }
    await delay(200);
  }
  throw new Error('The isolated API cannot reach the real test database.');
}

async function stopApi() {
  const child = server;
  if (!child || child.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
    child.kill();
  });
  server = undefined;
}

test('personal finance persists through reload, API restart and login with real PostgreSQL', async ({
  page,
}) => {
  const email = `real-e2e-${randomUUID()}@example.test`;
  const otherEmail = `real-e2e-${randomUUID()}@example.test`;
  const password = `test-only-${randomUUID()}`;
  const db = new pg.Client({ connectionString: databaseUrl });
  await db.connect();
  let submitted: { body: string; authorization: string; key: string } | undefined;
  page.on('request', (request) => {
    if (request.url().includes('/v1/transactions') && request.method() === 'POST') {
      submitted = {
        body: request.postData() ?? '',
        authorization: request.headers().authorization ?? '',
        key: request.headers()['idempotency-key'] ?? '',
      };
    }
  });
  try {
    await startApi();
    await page.goto('/login');
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(password);
    await page.getByLabel('Confirmar senha', { exact: true }).fill(password);
    const [registration, login] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url() === `${api}/auth/register` && response.request().method() === 'POST',
      ),
      page.waitForResponse(
        (response) =>
          response.url() === `${api}/auth/login` && response.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Criar minha conta', exact: true }).click(),
    ]);
    expect(registration.status()).toBe(201);
    expect(login.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: 'Cadastre sua primeira conta', exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/accounts$/);
    const empty = await db.query(
      'SELECT COUNT(*)::int AS count FROM "Account" WHERE "userId" = (SELECT id FROM "User" WHERE email = $1)',
      [email],
    );
    expect(empty.rows[0].count).toBe(0);
    // Interrupted onboarding resumes from real records after cookie restoration.
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Cadastre sua primeira conta', exact: true }),
    ).toBeVisible();
    await page.getByLabel('Nome da conta', { exact: true }).fill('Conta pessoal E2E');
    await page.getByLabel('Saldo inicial (R$)', { exact: true }).fill('1000');
    await page.getByRole('button', { name: 'Salvar conta', exact: true }).click();
    await expect(page.getByText('Conta salva no servidor.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir dashboard', exact: true }).click();
    await expect(page.getByLabel('Saldo disponível', { exact: true })).toContainText('1.000,00');

    for (const [kind, description, amount] of [
      ['+ Receita', 'Recebimento E2E', '500'],
      ['− Despesa', 'Pagamento E2E', '200'],
    ]) {
      await page.getByRole('button', { name: 'Nova receita ou despesa', exact: true }).click();
      await page.getByRole('radio', { name: kind, exact: true }).click();
      await page.getByLabel('Descrição', { exact: true }).fill(description);
      await page.getByLabel('Valor (R$)', { exact: true }).fill(amount);
      await page.getByRole('button', { name: 'Salvar lançamento', exact: true }).click();
      await expect(page.getByText('Lançamento salvo no servidor.', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Abrir dashboard', exact: true }).click();
    }
    await expect(page.getByLabel('Saldo disponível', { exact: true })).toContainText('1.300,00');
    if (!submitted) throw new Error('No real transaction HTTP request was observed.');
    const request = submitted as { body: string; authorization: string; key: string };
    const replay = await fetch(`${api}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: request.authorization,
        'Idempotency-Key': request.key,
      },
      body: request.body,
    });
    expect(replay.status).toBe(201);
    const stored = await db.query('SELECT "passwordHash" FROM "User" WHERE email = $1', [email]);
    expect(stored.rows[0].passwordHash.startsWith('scrypt$')).toBe(true);

    // Expire the access grant only: the HttpOnly refresh credential must renew
    // concurrent account/category/history reads without asking for a password.
    await db.query(
      'UPDATE "Session" SET "accessExpiresAt" = now() - interval \'1 second\' WHERE "userId" = (SELECT id FROM "User" WHERE email = $1)',
      [email],
    );
    await page.getByRole('button', { name: 'Minhas contas', exact: true }).click();
    await page.getByRole('button', { name: 'Editar nome', exact: true }).click();
    await page.getByLabel('Novo nome da conta', { exact: true }).fill('Conta renomeada E2E');
    await page.getByRole('button', { name: 'Salvar nome', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Conta renomeada E2E', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Arquivar conta', exact: true }).click();
    await expect(page.getByText('Arquivada · histórico preservado', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir dashboard', exact: true }).click();
    await expect(page.getByLabel('Saldo disponível', { exact: true })).toContainText('1.300,00');
    await page.getByRole('button', { name: 'Buscar e filtrar histórico', exact: true }).click();
    await page.getByLabel('Buscar movimentações', { exact: true }).fill('Pagamento E2E');
    // The navigator retains earlier screens in the DOM. Query accessible
    // history headings so the hidden dashboard does not count as a result.
    await expect(page.getByRole('heading', { name: 'Recebimento E2E', exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByRole('heading', { name: 'Pagamento E2E', exact: true })).toBeVisible();
    await page.goto('/');
    // Finish restoring the rotated cookie before starting another navigation.
    await expect(page.getByLabel('Saldo disponível', { exact: true })).toContainText('1.300,00');

    await page.reload();
    await expect(page.getByLabel('Saldo disponível', { exact: true })).toContainText('1.300,00');
    await stopApi();
    await startApi();
    await page.reload();
    await expect(page.getByLabel('Saldo disponível', { exact: true })).toContainText('1.300,00');
    const [logout] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url() === `${api}/auth/logout` && response.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Sair da conta', exact: true }).click(),
    ]);
    expect(logout.status()).toBe(200);
    const activeSessions = await db.query(
      'SELECT count(*)::int AS count FROM "Session" WHERE "userId" = (SELECT id FROM "User" WHERE email = $1) AND "revokedAt" IS NULL',
      [email],
    );
    expect(activeSessions.rows[0].count).toBe(0);
    await expect(
      page.getByRole('button', { name: 'Criar minha conta', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).click();
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByLabel('Saldo disponível', { exact: true })).toContainText('1.300,00');

    const post = (path: string, body: unknown) =>
      fetch(`${api}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    expect((await post('/auth/register', { email, password })).status).toBe(409);
    expect(
      (await post('/auth/login', { email, password: `${password}-wrong`, deviceName: 'test' }))
        .status,
    ).toBe(401);
    expect((await post('/auth/register', { email: 'invalid', password: 'short' })).status).toBe(
      400,
    );
    expect((await post('/auth/register', { email: otherEmail, password })).status).toBe(201);
    const second = await (
      await post('/auth/login', { email: otherEmail, password, deviceName: 'test' })
    ).json();
    const privateAccounts = await fetch(`${api}/accounts`, {
      headers: { Authorization: `Bearer ${second.accessToken}` },
    });
    expect(await privateAccounts.json()).toEqual([]);
    const forbidden = await fetch(`${api}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${second.accessToken}`,
        'Idempotency-Key': randomUUID(),
      },
      body: request.body,
    });
    expect(forbidden.status).toBe(400);
    const total = await db.query(
      'SELECT COUNT(*)::int AS count FROM "Transaction" WHERE "userId" = (SELECT id FROM "User" WHERE email = $1)',
      [email],
    );
    expect(total.rows[0].count).toBe(2);
  } finally {
    await stopApi();
    await db.query('DELETE FROM "User" WHERE email = ANY($1::text[])', [[email, otherEmail]]);
    await db.end();
  }
});
