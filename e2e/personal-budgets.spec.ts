import { test, expect } from './fixtures';

test('personal budgets create, edit and remove a monthly category limit without changing transactions', async ({
  page,
}, testInfo) => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const categoryId = '00000000-0000-4000-8000-000000000002';
  const budgetId = '00000000-0000-4000-8000-000000000003';
  let budget: Record<string, string> | null = null;
  let failedOnce = false;
  let writes = 0;
  await page.route('**/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (path === '/v1/budgets' && method === 'POST') {
      writes++;
      if (!failedOnce) {
        failedOnce = true;
        return route.fulfill({
          status: 503,
          json: { message: 'Unavailable' },
          headers: {
            'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
            'Access-Control-Allow-Credentials': 'true',
          },
        });
      }
      const body = request.postDataJSON();
      expect(body.categoryId).toBe(categoryId);
      expect(body.limitCents).toBe('80000');
      budget = {
        id: budgetId,
        categoryId,
        categoryName: 'Mercado',
        month: body.month,
        limitCents: body.limitCents,
        spentCents: '60000',
      };
    }
    if (path === `/v1/budgets/${budgetId}` && method === 'PATCH') {
      writes++;
      expect(request.postDataJSON().limitCents).toBe('90000');
      budget = { ...budget!, limitCents: '90000' };
    }
    if (path === `/v1/budgets/${budgetId}` && method === 'DELETE') {
      writes++;
      budget = null;
    }
    const json =
      path === '/v1/auth/session'
        ? {
            userId,
            sessionId: '00000000-0000-4000-8000-000000000004',
            accessToken: `ft_a_${'a'.repeat(43)}`,
            expiresAt: new Date(Date.now() + 600000).toISOString(),
          }
        : path === '/v1/categories'
          ? [{ id: categoryId, name: 'Mercado', kind: 'expense', essentialForReserve: false }]
          : path === '/v1/budgets' && method === 'GET'
            ? budget
              ? [budget]
              : []
            : method === 'DELETE'
              ? { success: true }
              : budget;
    if (!json) return route.abort();
    await route.fulfill({
      json,
      headers: {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  });
  await page.goto('/budgets');
  await expect(page.getByRole('heading', { name: 'Nenhum orçamento neste mês' })).toBeVisible();
  await page.getByRole('radio', { name: 'Mercado' }).click();
  const amount = page.getByLabel('Limite mensal (R$)');
  await amount.fill('800');
  await page.getByRole('button', { name: 'Salvar orçamento' }).click();
  await expect(amount).toHaveValue('800');
  await page.getByRole('button', { name: 'Salvar orçamento' }).click();
  await expect(page.getByText(/Disponível no orçamento.*200,00/)).toBeVisible();
  await page.screenshot({
    path: `test-results/budgets-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Editar' }).click();
  await amount.fill('900');
  await page.getByRole('button', { name: 'Salvar orçamento' }).click();
  await expect(page.getByText(/Disponível no orçamento.*300,00/)).toBeVisible();
  await page.getByRole('button', { name: 'Excluir' }).click();
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click();
  await expect(page.getByRole('heading', { name: 'Nenhum orçamento neste mês' })).toBeVisible();
  expect(writes).toBe(4);
});
