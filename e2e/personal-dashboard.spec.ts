import { test, expect } from './fixtures';
import { addMonths, dateInTimeZone } from '@fintrack/shared';

test('dashboard selects a historical month and excludes later transactions', async ({
  page,
}, testInfo) => {
  const accountId = '00000000-0000-4000-8000-000000000001';
  const currentDate = `${dateInTimeZone(new Date()).slice(0, 7)}-01`;
  const previousDate = addMonths(currentDate, -1).slice(0, 7) + '-10';
  await page.route('**/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json =
      path === '/v1/auth/session'
        ? {
            userId: accountId,
            sessionId: '00000000-0000-4000-8000-000000000002',
            accessToken: `ft_a_${'a'.repeat(43)}`,
            expiresAt: new Date(Date.now() + 600000).toISOString(),
          }
        : path === '/v1/accounts'
          ? [
              {
                id: accountId,
                name: 'Conta pessoal',
                type: 'checking',
                openingBalanceCents: '100000',
                openingDate: '2025-01-01',
                includeInPlan: true,
              },
            ]
          : path === '/v1/categories'
            ? []
            : path === '/v1/transactions'
              ? [
                  {
                    id: '00000000-0000-4000-8000-000000000003',
                    accountId,
                    kind: 'income',
                    amountCents: '50000',
                    description: 'Receita anterior',
                    date: previousDate,
                    status: 'posted',
                    revision: 1,
                  },
                  {
                    id: '00000000-0000-4000-8000-000000000004',
                    accountId,
                    kind: 'expense',
                    amountCents: '20000',
                    description: 'Despesa atual',
                    date: currentDate,
                    status: 'posted',
                    revision: 1,
                  },
                ]
              : null;
    if (!json) return route.abort();
    await route.fulfill({
      json,
      headers: {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Gastos por categoria' })).toBeVisible();
  await page.getByRole('button', { name: 'Mês anterior' }).click();
  await expect(page.getByText('Receita anterior', { exact: true })).toBeVisible();
  await expect(page.getByText('Despesa atual', { exact: true })).toHaveCount(0);
  await expect(page.getByText('R$ 1.500,00', { exact: true }).first()).toBeVisible();
  if (testInfo.project.name === 'mobile') {
    await expect(page.getByText('Início', { exact: true })).toBeVisible();
    await expect(page.getByText('Extrato', { exact: true })).toBeVisible();
  }
  await page.screenshot({
    path: `test-results/dashboard-${testInfo.project.name}.png`,
    fullPage: true,
  });
  if (testInfo.project.name === 'desktop') {
    await page.getByRole('button', { name: 'Cartões', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Cartões', exact: true })).toBeVisible();
  }
});
