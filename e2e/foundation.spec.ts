import { test, expect } from '@playwright/test';

test('all financial spaces are reachable and contain honest empty states', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Clareza para o seu dinheiro.', { exact: true })).toBeVisible();
  await page.getByText('Explorar contas', { exact: true }).click();
  await expect(page.getByText('Nenhuma conta disponível', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Atividade/ }).click();
  await expect(page.getByText('Sem movimentações disponíveis', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Cartões/ }).click();
  await expect(page.getByText('Nenhum cartão disponível', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Visão geral/ }).click();
  await page.screenshot({ path: `.cache/overview-${testInfo.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});

test('theme and privacy survive page reload and direct navigation', async ({ page }) => {
  await page.goto('/preferences');
  await page.getByRole('radio', { name: 'Escuro', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Escuro', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('switch', { name: 'Ocultar valores por padrão' }).click();
  await expect(page.getByRole('switch')).toBeChecked();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Escuro', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('switch')).toBeChecked();
  await page.getByRole('radio', { name: 'Claro', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Claro', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('corrupted stored settings show recovery and reset restores navigation', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('fintrack.preferences.v1', '{broken'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('danificadas');
  await page.getByRole('button', { name: 'Restaurar preferências padrão' }).click();
  await expect(page.getByText('Clareza para o seu dinheiro.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('fintrack.preferences.v1'))).toBeNull();
});

test('storage quota failure does not claim theme was saved', async ({ page }) => {
  await page.goto('/preferences');
  await expect(page.getByRole('radio', { name: 'Automático', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
  });
  await page.getByRole('radio', { name: 'Escuro', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível salvar');
  await expect(page.getByRole('radio', { name: 'Automático', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.reload();
  await page.getByRole('radio', { name: 'Escuro', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Escuro', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});
