import { test, expect } from './fixtures';

test('personal goal records progress without affecting accounts', async ({ page }, testInfo) => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const goalId = '00000000-0000-4000-8000-000000000002';
  const contributionId = '00000000-0000-4000-8000-000000000003';
  let goal: Record<string, unknown> | null = null;
  let contributions: Record<string, unknown>[] = [];
  let accountRequests = 0;
  let contributionKey = '';
  await page.route('**/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (path === '/v1/accounts') accountRequests++;
    if (path === '/v1/goals' && method === 'POST') {
      const body = request.postDataJSON();
      expect(body.targetCents).toBe('500000');
      goal = {
        id: goalId,
        name: body.name,
        targetCents: body.targetCents,
        targetOn: body.targetOn,
        status: 'active',
      };
    }
    if (path === `/v1/goals/${goalId}/contributions` && method === 'POST') {
      const body = request.postDataJSON();
      contributionKey = request.headers()['idempotency-key'];
      expect(body.amountCents).toBe('12345');
      contributions = [{ id: contributionId, ...body }];
    }
    if (path === `/v1/goals/${goalId}` && method === 'PATCH') {
      goal = { ...goal!, ...request.postDataJSON() };
    }
    if (path === `/v1/goals/${goalId}` && method === 'DELETE') goal = null;
    const current = goal
      ? {
          ...goal,
          contributedCents: contributions
            .reduce((sum, row) => sum + BigInt(row.amountCents as string), 0n)
            .toString(),
          contributions,
        }
      : null;
    const json =
      path === '/v1/auth/session'
        ? {
            userId,
            sessionId: '00000000-0000-4000-8000-000000000004',
            accessToken: `ft_a_${'a'.repeat(43)}`,
            expiresAt: new Date(Date.now() + 600000).toISOString(),
          }
        : path === '/v1/goals' && method === 'GET'
          ? current
            ? [current]
            : []
          : method === 'DELETE'
            ? { success: true }
            : current;
    if (!json) return route.abort();
    await route.fulfill({
      json,
      headers: {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  });
  await page.goto('/goals');
  await expect(page.getByRole('heading', { name: 'Nenhuma meta ainda' })).toBeVisible();
  await page.getByLabel('Nome da meta').fill('Reserva de emergência');
  await page.getByLabel('Valor desejado (R$)').fill('5000');
  await page.getByRole('button', { name: 'Salvar meta' }).click();
  await expect(page.getByRole('heading', { name: 'Reserva de emergência' })).toBeVisible();
  await page.getByRole('button', { name: 'Registrar valor' }).click();
  await page.getByLabel('Valor destinado (R$)').fill('123,45');
  await page.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(page.getByText(/123,45.*5\.000,00/)).toBeVisible();
  expect(contributionKey).toMatch(/^goal-/);
  expect(accountRequests).toBe(0);
  await page.screenshot({
    path: `test-results/goals-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Encerrar' }).click();
  await expect(page.getByRole('button', { name: 'Reabrir' })).toBeVisible();
  await page.getByRole('button', { name: 'Reabrir' }).click();
  await page.getByRole('button', { name: 'Excluir' }).click();
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click();
  await expect(page.getByRole('heading', { name: 'Nenhuma meta ainda' })).toBeVisible();
});
