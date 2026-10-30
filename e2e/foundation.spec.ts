import { test, expect } from '@playwright/test';

async function openArea(page: import('@playwright/test').Page, name: string) {
  if ((page.viewportSize()?.width ?? 1280) < 800) {
    const mobileLabel = name === 'Movimentações' ? 'Atividade' : name;
    await page.getByText(mobileLabel, { exact: true }).last().click();
    return;
  }
  await page.getByRole('button', { name, exact: true }).click();
}

test('dashboard and financial areas remain truthful and responsive', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Seu dinheiro, com mais clareza.', { exact: true })).toBeVisible();
  await expect(page.getByText('DADOS FINANCEIROS NÃO CONECTADOS', { exact: true })).toBeVisible();
  await expect(page.getByText('Um espaço pensado para você', { exact: true })).toBeVisible();

  await openArea(page, 'Contas');
  await expect(page.getByText('Nenhuma conta registrada', { exact: true })).toBeVisible();
  await openArea(page, 'Movimentações');
  await expect(page.getByText('Ainda não há movimentações', { exact: true })).toBeVisible();
  await openArea(page, 'Cartões');
  await expect(page.getByText('Cartões em preparação', { exact: true })).toBeVisible();
  await openArea(page, 'Visão geral');
  await page.screenshot({ path: `.cache/overview-${testInfo.project.name}.png`, fullPage: true });

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});

test('theme, language and privacy persist through reload', async ({ page }) => {
  await page.goto('/preferences');
  await expect(page.getByRole('radio', { name: 'Automático', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Escuro', exact: true }).click();
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
  await page.getByRole('radio', { name: 'Português (Brasil)', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible();
});

test('corrupt preferences can be reset and storage failures are reported honestly', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('fintrack.preferences.v1', '{broken'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('danificadas');
  await page.getByRole('button', { name: 'Restaurar preferências padrão' }).click();
  await expect(page.getByText('Seu dinheiro, com mais clareza.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('fintrack.preferences.v1'))).toBeNull();

  await page.goto('/preferences');
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
});

test('desktop sidebar collapse is persisted and exposes an accessible expand control', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.goto('/');
  const collapse = page.getByRole('button', { name: 'Recolher menu lateral' });
  await expect(collapse).toBeVisible();
  await collapse.click();
  await expect(page.getByRole('button', { name: 'Expandir menu lateral' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Expandir menu lateral' })).toBeVisible();
});
