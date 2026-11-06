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

test('rapid bill submissions issue one write and unlock after failure', async ({ page }) => {
  await mockFinance(page);
  let writes = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/v1/bills', async (route) => {
    if (route.request().method() === 'POST') {
      writes++;
      await pending;
      return route.fulfill({
        status: 503,
        json: {},
        headers: {
          'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
          'Access-Control-Allow-Credentials': 'true',
        },
      });
    }
    return route.fulfill({
      json: [],
      headers: {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  });
  await openFinance(page, '/bills');
  await page.getByLabel('Descrição', { exact: true }).fill('Electricity');
  await page.getByLabel('Valor', { exact: true }).fill('100');
  const save = page.getByRole('button', { name: 'Cadastrar conta', exact: true });
  await expect(save).toBeEnabled();
  await save.evaluate((node) => {
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await expect.poll(() => writes).toBe(1);
  await expect(save).toBeDisabled();
  release();
  await expect(save).toBeEnabled();
  await expect(page.getByLabel('Descrição', { exact: true })).toHaveValue('Electricity');
  expect(writes).toBe(1);
});

test('account fields expose their disabled state during saving', async ({ page }) => {
  await mockFinance(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/v1/accounts', async (route) => {
    const saving = route.request().method() === 'POST';
    if (saving) await pending;
    await route.fulfill({
      json: saving ? account : [account],
      headers: {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  });
  await openFinance(page, '/accounts');
  const name = page.getByLabel('Nome da conta', { exact: true });
  await name.fill('Accessible');
  await page.getByRole('button', { name: 'Salvar conta', exact: true }).click();
  await expect(name).toHaveAttribute('aria-disabled', 'true');
  release();
  await expect(name).toBeEnabled();
});

test('long account selectors fit a 320px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await mockFinance(page);
  await page.route('**/v1/accounts', (route) =>
    route.fulfill({
      json: [
        {
          ...account,
          name: 'Conta financeira para despesas compartilhadas da família e investimentos',
        },
      ],
      headers: {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
        'Access-Control-Allow-Credentials': 'true',
      },
    }),
  );
  await openFinance(page, '/transaction');
  const selector = page.getByRole('radio', {
    name: /Conta financeira para despesas compartilhadas/,
  });
  await expect(selector).toBeVisible();
  const bounds = await selector.boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});
