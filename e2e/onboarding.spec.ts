import { test, expect } from '@playwright/test';

test('new users see personal registration first and demo only as a secondary path', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Comece com seus dados' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar minha conta' })).toBeVisible();
  await expect(page.getByText('DEMONSTRAÇÃO · DADOS FICTÍCIOS', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click();
  await expect(page.getByRole('button', { name: 'Começar com meus dados' })).toBeVisible();
});
