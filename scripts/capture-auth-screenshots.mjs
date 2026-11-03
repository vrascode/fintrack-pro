// Capture real empty forms in fresh browser contexts; never include credentials.
import { mkdirSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';

const web = new URL(process.argv[2] ?? 'http://localhost:8081');
if (!['localhost', '127.0.0.1'].includes(web.hostname) || web.username || web.password)
  throw new Error('Use a local app URL.');
mkdirSync('docs/screenshots', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const [name, viewport] of [
    ['desktop', { width: 1440, height: 1000 }],
    ['mobile', { width: 390, height: 1320 }],
  ]) {
    const context = await browser.newContext({
      viewport,
      colorScheme: 'dark',
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      await page.goto(`${web.origin}/login`);
      await expect(page.getByTestId('auth-form-panel')).toBeVisible();
      await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue('');
      await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('');
      await expect(page.getByLabel('Confirmar senha', { exact: true })).toHaveValue('');
      await page.screenshot({ path: `docs/screenshots/auth-register-${name}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).click();
      await expect(
        page.getByRole('heading', { name: 'Bem-vindo de volta', exact: true }),
      ).toBeVisible();
      await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue('');
      await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('');
      await page.screenshot({ path: `docs/screenshots/auth-login-${name}.png`, fullPage: true });
      console.log(`Captured real, empty ${name} registration/login forms.`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
