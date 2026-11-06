import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const userId = '00000000-0000-4000-8000-000000000001';
const accountId = '00000000-0000-4000-8000-000000000002';
const account = {
  id: accountId,
  name: 'Main',
  type: 'checking',
  openingDate: '2025-01-01',
  openingBalanceCents: '0',
  includeInPlan: true,
};

async function mockFinance(page: Page, waitForCards?: Promise<void>) {
  await page.route('**/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/v1/cards') await waitForCards;
    const json =
      path === '/v1/auth/session'
        ? {
            userId,
            sessionId: accountId,
            accessToken: `ft_a_${'a'.repeat(43)}`,
            expiresAt: new Date(Date.now() + 600000).toISOString(),
          }
        : path === '/v1/accounts'
          ? [account]
          : [];
    await route.fulfill({
      json,
      headers: {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  });
}

async function openFinance(page: Page, path: string) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Suas finanças', exact: true })).toBeVisible();
  await page.goto(path);
}

test('cards expose a busy loading state until the response arrives', async ({ page }) => {
  let release!: () => void;
  await mockFinance(
    page,
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  await openFinance(page, '/cards');
  const loading = page.getByRole('progressbar', { name: 'Carregando cartões…', exact: true });
  await expect(loading.first()).toBeVisible();
  await expect(loading.first()).toHaveAttribute('aria-busy', 'true');
  release();
  await expect(loading).toHaveCount(0);
});

test('empty cards and bills explain the next action', async ({ page }) => {
  await mockFinance(page);
  await openFinance(page, '/cards');
  await expect(page.getByRole('heading', { name: 'Nenhum cartão cadastrado.' })).toBeVisible();
  await expect(page.getByText(/Cadastre seu primeiro cartão no formulário/)).toBeVisible();
  await openFinance(page, '/bills');
  await expect(
    page.getByRole('heading', { name: 'Nenhuma conta mensal cadastrada.' }),
  ).toBeVisible();
});

test('a successful account save announces one feedback message', async ({ page }) => {
  await mockFinance(page);
  await page.route('**/v1/accounts', async (route) => {
    await route.fulfill({
      json: route.request().method() === 'POST' ? account : [account],
      headers: {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  });
  await openFinance(page, '/accounts');
  await page.getByLabel('Nome da conta', { exact: true }).fill('Saved');
  await page.getByRole('button', { name: 'Salvar conta', exact: true }).click();
  const success = page.getByText('Conta salva no servidor.', { exact: true });
  await expect(success).toHaveCount(1);
  await expect(success).toHaveAttribute('aria-live', 'polite');
});
