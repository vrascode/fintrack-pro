import { chromium } from '@playwright/test';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = resolve(root, 'apps/mobile/assets/brand');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1024, height: 1024 },
    deviceScaleFactor: 1,
  });
  const svg = async (name) => readFile(resolve(assets, name), 'utf8');
  const render = async ({ name, width, height, background, output }) => {
    const markup = await svg(name);
    await page.setViewportSize({ width, height });
    await page.setContent(
      `<style>html,body{margin:0;width:100%;height:100%;background:${background ?? 'transparent'};overflow:hidden}svg{display:block;width:100%;height:100%}</style>${markup}`,
    );
    await page.locator('svg').screenshot({
      path: resolve(root, output),
      omitBackground: background === undefined,
      animations: 'disabled',
    });
  };
  await mkdir(assets, { recursive: true });
  await mkdir(resolve(assets, 'android'), { recursive: true });
  await mkdir(resolve(assets, 'web'), { recursive: true });
  await mkdir(resolve(root, 'apps/mobile/public'), { recursive: true });
  await render({
    name: 'wordmark-dark.svg',
    width: 500,
    height: 128,
    output: 'apps/mobile/assets/brand/wordmark-dark.png',
  });
  await render({
    name: 'wordmark-light.svg',
    width: 500,
    height: 128,
    output: 'apps/mobile/assets/brand/wordmark-light.png',
  });
  await render({
    name: 'wordmark-dark.svg',
    width: 1000,
    height: 256,
    output: 'apps/mobile/assets/brand/splash.png',
  });
  await render({
    name: 'mark.svg',
    width: 1024,
    height: 1024,
    background: '#0A0A0A',
    output: 'apps/mobile/assets/brand/icon.png',
  });
  await render({
    name: 'mark.svg',
    width: 1024,
    height: 1024,
    output: 'apps/mobile/assets/brand/android/adaptive-foreground.png',
  });
  await render({
    name: 'monochrome.svg',
    width: 1024,
    height: 1024,
    output: 'apps/mobile/assets/brand/android/monochrome.png',
  });
  await render({
    name: 'mark.svg',
    width: 192,
    height: 192,
    background: '#0A0A0A',
    output: 'apps/mobile/assets/brand/web/pwa-192.png',
  });
  await render({
    name: 'mark.svg',
    width: 512,
    height: 512,
    background: '#0A0A0A',
    output: 'apps/mobile/assets/brand/web/pwa-512.png',
  });
  await render({
    name: 'mark.svg',
    width: 180,
    height: 180,
    background: '#0A0A0A',
    output: 'apps/mobile/assets/brand/web/apple-touch-icon.png',
  });
  await render({
    name: 'mark.svg',
    width: 48,
    height: 48,
    background: '#0A0A0A',
    output: 'apps/mobile/assets/brand/web/favicon.png',
  });
  await render({
    name: 'social-card.svg',
    width: 1200,
    height: 630,
    output: 'apps/mobile/assets/brand/web/social-card.png',
  });
  for (const file of [
    'favicon.png',
    'apple-touch-icon.png',
    'pwa-192.png',
    'pwa-512.png',
    'social-card.png',
  ]) {
    const publicName = file === 'favicon.png' ? 'favicon.png' : file;
    await copyFile(resolve(assets, 'web', file), resolve(root, 'apps/mobile/public', publicName));
  }
} finally {
  await browser.close();
}
