import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { assertAndroidApiReady, buildAndroid } from '../scripts/android-release.mjs';

const root = resolve(import.meta.dirname, '..');
const configUrl = pathToFileURL(resolve(root, 'apps/mobile/app.config.js')).href;

function resolveRelease(url) {
  return spawnSync(process.execPath, ['-e', `import(${JSON.stringify(configUrl)})`], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      FINTRACK_RELEASE: '1',
      EXPO_PUBLIC_API_URL: url,
    },
  });
}

test('Vercel production export rejects a missing public API URL', () => {
  const result = spawnSync(process.execPath, ['-e', `import(${JSON.stringify(configUrl)})`], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, VERCEL: '1', FINTRACK_RELEASE: '0', EXPO_PUBLIC_API_URL: '' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /EXPO_PUBLIC_API_URL/);
});

test('Android release rejects local, placeholder and missing API endpoints', () => {
  for (const url of [
    '',
    'http://localhost:3000/v1',
    'https://127.0.0.1/v1',
    'https://api.example.com/v1',
    'https://api.fintrack.invalid/v1',
    'https://api.fintrack.app/other',
  ]) {
    assert.notEqual(resolveRelease(url).status, 0, url || '(missing)');
  }
  assert.equal(resolveRelease('https://api.fintrack.app/v1').status, 0);
});

test('Android APK profile uses the same brand artwork as the Web favicon', () => {
  const app = JSON.parse(readFileSync(resolve(root, 'apps/mobile/app.json'), 'utf8')).expo;
  const eas = JSON.parse(readFileSync(resolve(root, 'apps/mobile/eas.json'), 'utf8'));
  const generator = readFileSync(resolve(root, 'scripts/generate-brand-assets.mjs'), 'utf8');
  assert.equal(app.name, 'FinTrack Pro');
  assert.equal(app.android.package, 'com.fintrackpro.app');
  assert.equal(eas.build.preview.android.buildType, 'apk');
  assert.equal(eas.build.preview.distribution, 'internal');
  assert.equal(eas.build.preview.env.FINTRACK_RELEASE, '1');
  assert.match(
    generator,
    /name: 'mark.svg',[\s\S]*?output: 'apps\/mobile\/assets\/brand\/icon.png'/,
  );
  assert.match(
    generator,
    /name: 'mark.svg',[\s\S]*?output: 'apps\/mobile\/assets\/brand\/android\/adaptive-foreground.png'/,
  );
  assert.match(
    generator,
    /name: 'mark.svg',[\s\S]*?output: 'apps\/mobile\/assets\/brand\/web\/favicon.png'/,
  );
  for (const relative of [
    app.icon,
    app.android.adaptiveIcon.foregroundImage,
    app.android.adaptiveIcon.monochromeImage,
    app.web.favicon,
  ]) {
    const png = readFileSync(resolve(root, 'apps/mobile', relative), 'binary');
    assert.equal(png.slice(1, 4), 'PNG');
  }
});

test('Android release requires a live API that confirms database readiness', async () => {
  const url = 'https://api.fintrack.app/v1';
  assert.equal(
    await assertAndroidApiReady(url, async (requested) => {
      assert.equal(requested, `${url}/health/ready`);
      return {
        ok: true,
        json: async () => ({ service: 'fintrack-api', status: 'ok', scope: 'database' }),
      };
    }),
    url,
  );
  await assert.rejects(
    assertAndroidApiReady(url, async () => ({
      ok: false,
      status: 503,
    })),
    /HTTP 503/,
  );
  await assert.rejects(
    assertAndroidApiReady(url, async () => ({
      ok: true,
      json: async () => ({ status: 'ok', scope: 'process' }),
    })),
    /database readiness/,
  );
  await assert.rejects(
    assertAndroidApiReady(url, async () => ({
      ok: true,
      json: async () => ({ service: 'another-api', status: 'ok', scope: 'database' }),
    })),
    /database readiness/,
  );
});

test('APK build receives the validated public URL and an absolute workspace', () => {
  const environment = { EXPO_PUBLIC_API_URL: 'https://api.fintrack.app/v1', CI: '1' };
  let invocation;
  buildAndroid(environment, (...args) => {
    invocation = args;
    return { status: 0 };
  });
  assert.equal(invocation[0], process.platform === 'win32' ? 'eas.cmd' : 'eas');
  assert.deepEqual(invocation[1], [
    'build',
    '--platform',
    'android',
    '--profile',
    'preview',
    '--wait',
  ]);
  assert.equal(resolve(invocation[2].cwd), resolve(root, 'apps/mobile'));
  assert.equal(invocation[2].env.EXPO_PUBLIC_API_URL, environment.EXPO_PUBLIC_API_URL);
  assert.equal(invocation[2].env.FINTRACK_RELEASE, '1');
  assert.equal(environment.FINTRACK_RELEASE, undefined);
  assert.throws(
    () => buildAndroid(environment, () => ({ error: new Error('ENOENT') })),
    /Could not start EAS/,
  );
  assert.throws(() => buildAndroid(environment, () => ({ status: 1 })), /no release was confirmed/);
  assert.throws(
    () => buildAndroid(environment, () => ({ status: null, signal: 'SIGTERM' })),
    /no release was confirmed/,
  );
});
