import { test, expect } from './fixtures';

const passwordValue = 'synthetic-interface-test-phrase';
async function fillRegistration(page: import('@playwright/test').Page) {
  await page.getByLabel('E-mail', { exact: true }).fill('interface@example.test');
  await page.getByLabel('Senha', { exact: true }).fill(passwordValue);
  await page.getByLabel('Confirmar senha', { exact: true }).fill(passwordValue);
}

test('auth layout adapts from desktop split view to narrow and short screens', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 768, height: 800 },
    { width: 320, height: 568 },
    { width: 740, height: 360 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Suas finanças sob controle.' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const intro = await page.getByTestId('auth-introduction').boundingBox();
    const panel = await page.getByTestId('auth-form-panel').boundingBox();
    if (!intro || !panel) throw new Error('Missing authentication layout');
    expect(viewport.width >= 1080 ? panel.x > intro.x : panel.y >= intro.y + intro.height - 1).toBe(
      true,
    );
    const submit = page.getByRole('button', { name: 'Criar minha conta', exact: true });
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeVisible();
  }
});

test('password visibility, keyboard progression and accessible validation retain entered values', async ({
  page,
}) => {
  await page.goto('/login');
  const email = page.getByLabel('E-mail', { exact: true });
  const password = page.getByLabel('Senha', { exact: true });
  const confirmation = page.getByLabel('Confirmar senha', { exact: true });
  await email.fill('interface@example.test');
  await email.press('Enter');
  await expect(password).toBeFocused();
  await password.fill(passwordValue);
  await password.press('Enter');
  await expect(confirmation).toBeFocused();
  await confirmation.fill(passwordValue);
  await expect(password).toHaveJSProperty('type', 'password');
  await page.getByRole('button', { name: 'Mostrar senha', exact: true }).click();
  await expect(password).toHaveJSProperty('type', 'text');
  await expect(confirmation).toHaveJSProperty('type', 'text');
  await expect(password).toHaveValue(passwordValue);
  await page.getByRole('button', { name: 'Ocultar senha', exact: true }).click();
  await expect(password).toHaveJSProperty('type', 'password');
  await email.fill('invalid');
  await email.blur();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  const description = await email.getAttribute('aria-describedby');
  expect(description).toBeTruthy();
  await expect(page.locator(`[id="${description}"]`)).toContainText('Informe um e-mail válido.');
});

test('orange actions have visible focus and touch targets in both themes', async ({ page }) => {
  await page.goto('/login');
  await fillRegistration(page);
  for (const theme of ['Claro', 'Escuro']) {
    await page.getByRole('radio', { name: theme, exact: true }).click();
    const submit = page.getByRole('button', { name: 'Criar minha conta', exact: true });
    await submit.focus();
    await expect(submit).toHaveCSS('background-color', 'rgb(200, 74, 1)');
    await expect(submit).not.toHaveCSS('border-color', 'rgba(0, 0, 0, 0)');
    for (const button of [
      submit,
      page.getByRole('button', { name: 'Mostrar senha', exact: true }),
    ]) {
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test('loading disables duplicate submission and preserves credentials after a safe API rejection', async ({
  page,
}) => {
  let count = 0;
  let release!: () => void;
  let signalRequestStarted!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    signalRequestStarted = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/v1/auth/register', async (route) => {
    expect(route.request().method()).toBe('POST');
    count++;
    signalRequestStarted();
    await gate;
    await route.fulfill({
      status: 409,
      json: { message: 'Duplicate synthetic email' },
      headers: {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  });
  try {
    await page.goto('/login');
    await fillRegistration(page);
    await page.getByRole('button', { name: 'Criar minha conta', exact: true }).dblclick();
    // Loading renders before Playwright necessarily delivers the route callback.
    // Synchronize with the callback itself while its response is still held.
    await requestStarted;
    const loading = page.getByRole('button', { name: 'Conectando…', exact: true });
    await expect(loading).toBeDisabled();
    await expect(loading).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByLabel('E-mail', { exact: true })).not.toBeEditable();
    expect(count).toBe(1);
    release();
    await expect(
      page.getByText('Já existe uma conta com este e-mail. Entre nela.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue('interface@example.test');
    await expect(page.getByLabel('Senha', { exact: true })).toHaveValue(passwordValue);
    await expect(page.getByLabel('Confirmar senha', { exact: true })).toHaveValue(passwordValue);
    expect(count).toBe(1);
  } finally {
    release();
  }
});

test('switching login and registration respects reduced motion without clearing email or password', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');
  await fillRegistration(page);
  await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Bem-vindo de volta', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('auth-form-content')).toHaveCSS('opacity', '1');
  await expect(page.getByLabel('Senha', { exact: true })).toHaveValue(passwordValue);
  await expect(page.getByLabel('Confirmar senha', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Começar com meus dados', exact: true }).click();
  await expect(page.getByTestId('auth-form-content')).toHaveCSS('opacity', '1');
  await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue('interface@example.test');
});
