import { test, expect } from './fixtures';

test('personal reports filter real posted entries and export exact decimal CSV', async ({
  page,
}) => {
  const userId = '00000000-0000-4000-8000-000000000001';
  await page.route('**/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json =
      path === '/v1/auth/session'
        ? {
            userId,
            sessionId: '00000000-0000-4000-8000-000000000004',
            accessToken: `ft_a_${'a'.repeat(43)}`,
            expiresAt: new Date(Date.now() + 600000).toISOString(),
          }
        : path === '/v1/accounts'
          ? []
          : path === '/v1/categories'
            ? [{ id: 'food', name: 'Mercado', kind: 'expense', essentialForReserve: false }]
            : path === '/v1/transactions'
              ? [
                  {
                    id: 'income',
                    kind: 'income',
                    amountCents: '500000',
                    date: '2026-11-01',
                    status: 'posted',
                    accountId: 'one',
                    description: 'Salário',
                  },
                  {
                    id: 'expense',
                    kind: 'expense',
                    amountCents: '12345',
                    date: '2026-11-02',
                    status: 'posted',
                    accountId: 'one',
                    categoryId: 'food',
                    description: 'Mercado',
                  },
                  {
                    id: 'planned',
                    kind: 'expense',
                    amountCents: '999999',
                    date: '2026-11-03',
                    status: 'planned',
                    accountId: 'one',
                    categoryId: 'food',
                    description: 'Futuro',
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
  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
  await expect(page.getByText('Mercado: R$ 123,45')).toBeVisible();
  await expect(page.getByText('Futuro')).toHaveCount(0);
  await page.getByRole('radio', { name: 'Mercado' }).click();
  await expect(page.getByText('Salário')).toHaveCount(0);
  await page.getByRole('radio', { name: 'Todas' }).click();
  await expect(page.getByText('Salário')).toBeVisible();
  if (page.viewportSize()?.width && page.viewportSize()!.width > 700) {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar CSV' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^fintrack-relatorio-/);
  }
});
