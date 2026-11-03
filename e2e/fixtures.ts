import { test as base, expect } from '@playwright/test';

// UI/demo tests must never reach a personal or external API. Real PostgreSQL
// acceptance lives separately in e2e/real and validate-local-auth.mjs.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/v1/**', (route) => route.abort('connectionrefused'));
    await use(page);
  },
});
export { expect };
