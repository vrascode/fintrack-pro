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

test('registration validates inputs and preserves them when the API is unavailable', async ({
  page,
}) => {
  await page.goto('/login');
  const email = page.getByLabel('E-mail');
  const password = page.getByLabel('Senha');
  const submit = page.getByRole('button', { name: 'Criar minha conta' });

  await email.fill('invalid-email');
  await password.fill('short');
  await password.blur();
  await expect(submit).toBeDisabled();
  await expect(page.getByText('Informe um e-mail válido.')).toBeVisible();
  await expect(page.getByText('A senha precisa ter de 15 a 128 caracteres válidos.')).toBeVisible();

  await email.fill('new-user@example.test');
  await password.fill('correct horse battery');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(
    page.getByText('Não foi possível acessar a API. Confira a conexão e tente novamente.'),
  ).toBeVisible();
  await expect(email).toHaveValue('new-user@example.test');
  await expect(password).toHaveValue('correct horse battery');
});
