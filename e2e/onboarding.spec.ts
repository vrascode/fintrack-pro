import { test, expect } from './fixtures';

test('new users see personal registration first and demo only as a secondary path', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Suas finanças sob controle.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar minha conta' })).toBeVisible();
  await expect(page.getByText('DEMONSTRAÇÃO · DADOS FICTÍCIOS', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click();
  await expect(page.getByRole('button', { name: 'Começar com meus dados' })).toBeVisible();
});

test('login appearance and language preferences persist without entering demo', async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByRole('radio', { name: 'Escuro', exact: true }).click();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Your finances. In your control.' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await page.screenshot({ path: `.cache/login-${info.project.name}.png`, fullPage: true });
});

test('registration validates inputs and preserves them when the API is unavailable', async ({
  page,
}) => {
  await page.route('**/v1/**', (route) => route.abort('connectionrefused'));
  await page.goto('/login');
  const email = page.getByLabel('E-mail');
  const password = page.getByLabel('Senha', { exact: true });
  const submit = page.getByRole('button', { name: 'Criar minha conta' });

  await email.fill('invalid-email');
  await password.fill('short');
  await password.blur();
  await expect(submit).toBeDisabled();
  await expect(page.getByText('Informe um e-mail válido.')).toBeVisible();
  await expect(page.getByText('A senha precisa ter de 15 a 128 caracteres válidos.')).toBeVisible();

  await email.fill('new-user@example.test');
  await password.fill('correct horse battery');
  await expect(submit).toBeDisabled();
  const confirmation = page.getByLabel('Confirmar senha', { exact: true });
  await confirmation.fill('different password');
  await confirmation.blur();
  await expect(page.getByText('As senhas precisam ser iguais.')).toBeVisible();
  await expect(submit).toBeDisabled();
  await confirmation.fill('correct horse battery');
  await expect(submit).toBeEnabled();
  const attempted = page.waitForRequest('**/v1/auth/register');
  await submit.click();
  await attempted;
  await expect(
    page.getByText('Não foi possível acessar a API. Confira a conexão e tente novamente.'),
  ).toBeVisible();
  await expect(email).toHaveValue('new-user@example.test');
  await expect(password).toHaveValue('correct horse battery');
});

for (const [status, message] of [
  [403, 'O servidor não autorizou o acesso deste aplicativo.'],
  [409, 'Já existe uma conta com este e-mail. Entre nela.'],
  [429, 'Muitas tentativas. Aguarde um minuto e tente novamente.'],
  [500, 'O servidor não conseguiu concluir a solicitação. Tente novamente.'],
  [
    503,
    'O servidor está acessível, mas o banco de dados está indisponível. Tente novamente após a configuração do servidor.',
  ],
] as const) {
  test(`registration distinguishes HTTP ${status} from a connection failure`, async ({ page }) => {
    await page.route('**/v1/**', (route) =>
      route.fulfill({
        status: route.request().url().endsWith('/auth/register') ? status : 401,
        json: { message: 'Controlled rejection' },
        headers: {
          'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
          'Access-Control-Allow-Credentials': 'true',
        },
      }),
    );
    await page.goto('/login');
    await page.getByLabel('E-mail', { exact: true }).fill('synthetic-ui@example.test');
    await page.getByLabel('Senha', { exact: true }).fill('synthetic-ui-only-passphrase');
    await page.getByLabel('Confirmar senha', { exact: true }).fill('synthetic-ui-only-passphrase');
    await page.getByRole('button', { name: 'Criar minha conta', exact: true }).click();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue(
      'synthetic-ui@example.test',
    );
  });
}
