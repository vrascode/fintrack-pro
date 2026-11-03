import { test, expect } from './fixtures';

test('account name editor retains its value after an API failure and closes after a successful retry', async ({
  page,
}) => {
  const accountId = '00000000-0000-4000-8000-000000000001';
  let name = 'Conta pessoal';
  let updates = 0;
  await page.route('**/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === `/v1/accounts/${accountId}` && request.method() === 'PATCH') {
      updates++;
      if (updates === 1)
        return route.fulfill({
          status: 503,
          json: { message: 'Unavailable' },
          headers: {
            'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
            'Access-Control-Allow-Credentials': 'true',
          },
        });
      name = request.postDataJSON().name;
      return route.fulfill({
        json: { success: true },
        headers: {
          'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
          'Access-Control-Allow-Credentials': 'true',
        },
      });
    }
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
                name,
                type: 'checking',
                openingBalanceCents: '100000',
                openingDate: '2025-01-01',
                includeInPlan: true,
              },
            ]
          : path === '/v1/categories' || path === '/v1/transactions'
            ? []
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
  await page.goto('/accounts');
  await page.getByRole('button', { name: 'Editar nome' }).click();
  const input = page.getByLabel('Novo nome da conta');
  await input.fill('Conta atualizada');
  await page.getByRole('button', { name: 'Salvar nome' }).click();
  await expect(input).toHaveValue('Conta atualizada');
  await expect(page.getByRole('button', { name: 'Salvar nome' })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar nome' }).click();
  await expect(page.getByRole('button', { name: 'Editar nome' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Conta atualizada' })).toBeVisible();
  expect(updates).toBe(2);
});
