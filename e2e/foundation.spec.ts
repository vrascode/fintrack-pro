import { test, expect } from '@playwright/test';

test('fictional dashboard and financial pages stay responsive', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Seu dinheiro, com mais clareza.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Explorar demonstração' }).click();
  await expect(page.getByText('DEMONSTRAÇÃO · DADOS FICTÍCIOS', { exact: true })).toBeVisible();
  await expect(page.getByText(/7\.340,00/)).toBeVisible();
  await expect(page.getByText(/84% da renda em despesas planejadas/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: `.cache/overview-${testInfo.project.name}.png`, fullPage: true });

  await page.goto('/accounts');
  await expect(page.getByText('Conta do dia a dia', { exact: true })).toBeVisible();
  await expect(page.getByText('Conta poupança', { exact: true })).toBeVisible();
  await page.goto('/activity');
  await expect(page.getByText('Salário mensal').first()).toBeVisible();
  await page.getByRole('textbox', { name: 'Buscar movimentações' }).fill('salário mensal');
  await expect(page.getByText('Aluguel', { exact: true })).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  expect((await download).suggestedFilename()).toBe('fintrack-demo-transactions.csv');

  await page.goto('/transaction');
  await page.getByRole('textbox', { name: 'Descrição' }).fill('Freelance project');
  await page.getByRole('textbox', { name: 'Valor' }).fill('300,00');
  await page.getByRole('radio', { name: 'Receita', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar na demonstração' }).click();
  await expect(page.getByText('Registro adicionado à demonstração fictícia.')).toBeVisible();
  await page.goto('/accounts');
  await expect(page.getByText(/7\.640,00/)).toBeVisible();

  await page.goto('/bills');
  await expect(page.getByText('Água', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Registrar pagamento' }).first().click();
  await expect(page.getByText('Pagamento registrado somente na demonstração.')).toBeVisible();
  await page.goto('/envelopes');
  await expect(page.getByText('Reserva de emergência', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Valor do aporte ou resgate' }).first().fill('25,00');
  await page.getByRole('button', { name: 'Reservar' }).first().click();
  await expect(page.getByText('Movimentação registrada na caixinha fictícia.')).toBeVisible();
  await page.goto('/planning');
  await expect(page.getByText('Sobra mensal simulada', { exact: true })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible();
  await expect(page.getByText('DEMONSTRAÇÃO · DADOS FICTÍCIOS', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});

test('theme, language and privacy persist through reload', async ({ page }) => {
  await page.goto('/preferences');
  await expect(page.getByRole('radio', { name: /Autom/ })).toBeVisible();
  await page.getByRole('radio', { name: /Escuro/ }).click();
  await page.getByRole('radio', { name: 'English', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await page.getByRole('switch', { name: 'Hide amounts when available' }).click();
  await expect(page.getByRole('switch')).toBeChecked();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('radio', { name: 'English', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('switch')).toBeChecked();
  await page.getByRole('radio', { name: 'System', exact: true }).click();
  await page.getByRole('radio', { name: /Portugu/ }).click();
});

test('corrupt preferences can be reset without silently overwriting them', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('fintrack.preferences.v1', '{broken'));
  await page.reload();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: /Restaurar prefer/ }).click();
  await expect(page.getByRole('button', { name: 'Explorar demonstração' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('fintrack.preferences.v1'))).toBeNull();
});
