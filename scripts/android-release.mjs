import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { productionApiUrl } from './release.mjs';

export async function assertAndroidApiReady(value, request = fetch) {
  const url = productionApiUrl(value);
  const response = await request(`${url}/health/ready`, {
    signal: AbortSignal.timeout(10000),
    redirect: 'error',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Public API readiness returned HTTP ${response.status}.`);
  const body = await response.json();
  if (body?.status !== 'ok' || body?.scope !== 'database') {
    throw new Error('Public API did not confirm database readiness.');
  }
  return url;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const url = await assertAndroidApiReady(process.env.EXPO_PUBLIC_API_URL);
    console.log(`Public API and database are reachable at ${url}. Starting Android APK build.`);
    const executable = process.platform === 'win32' ? 'eas.cmd' : 'eas';
    const result = spawnSync(
      executable,
      ['build', '--platform', 'android', '--profile', 'preview', '--wait'],
      {
        cwd: resolve('apps/mobile'),
        stdio: 'inherit',
        windowsHide: true,
        shell: process.platform === 'win32',
      },
    );
    if (result.error) throw new Error(`Could not start EAS CLI: ${result.error.message}`);
    process.exitCode = result.status ?? 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
