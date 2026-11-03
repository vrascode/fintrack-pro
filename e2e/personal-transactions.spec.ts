import { test, expect } from './fixtures';
import type { FinancialTransaction } from '@fintrack/shared';

test('personal history edits and confirms removal while retaining filters', async ({
  page,
}, testInfo) => {
  const accountId = '00000000-0000-4000-8000-000000000001';
  const transactionId = '00000000-0000-4000-8000-000000000002';
  let entries: FinancialTransaction[] = [
    {
      id: transactionId,
      kind: 'expense',
      accountId,
      amountCents: '1250',
      date: '2026-01-10',
      description: 'Compra teste',
      status: 'posted',
      revision: 1,
    },
  ];
  let removals = 0;
  await page.route('**/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let json: unknown;
    if (path === '/v1/auth/session')
      json = {
        userId: accountId,
        sessionId: transactionId,
        accessToken: `ft_a_${'a'.repeat(43)}`,
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      };
    else if (path === '/v1/accounts')
      json = [
        {
          id: accountId,
          name: 'Conta teste',
          type: 'checking',
          openingBalanceCents: '100000',
          openingDate: '2026-01-01',
          includeInPlan: true,
        },
      ];
    else if (path === '/v1/categories') json = [];
    else if (path === '/v1/transactions') json = entries;
    else if (path === `/v1/transactions/${transactionId}` && request.method() === 'PATCH') {
      const body = request.postDataJSON();
      expect(body.revision).toBe(1);
      expect(body.transaction.amountCents).toBe('2500');
      entries = [{ ...entries[0]!, ...body.transaction, revision: 2 }];
      json = entries[0];
    } else if (path === `/v1/transactions/${transactionId}` && request.method() === 'DELETE') {
      expect(request.postDataJSON().revision).toBe(2);
      removals++;
      entries = [];
      json = { success: true };
    } else return route.abort();
    await route.fulfill({
      json,
      headers: {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  });
  await page.goto('/activity');
  await page.getByLabel('Buscar movimentações').fill('Compra');
  await page.getByRole('button', { name: 'Editar ou excluir', exact: true }).click();
  await page.getByLabel('Valor (R$)', { exact: true }).fill('25,00');
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(page.getByText('Alteração salva no servidor.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Buscar movimentações')).toHaveValue('Compra');
  await expect(page.getByText(/25,00/)).toBeVisible();
  await page.screenshot({
    path: `.cache/personal-history-synthetic-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Editar ou excluir', exact: true }).click();
  await page.getByRole('button', { name: 'Excluir lançamento', exact: true }).click();
  expect(removals).toBe(0);
  await page.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click();
  await expect(
    page.getByText('Nenhuma movimentação neste período.', { exact: true }),
  ).toBeVisible();
  expect(removals).toBe(1);
});
