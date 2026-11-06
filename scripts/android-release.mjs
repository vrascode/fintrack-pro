import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { productionApiUrl, releaseEnvironment } from './release.mjs';

const mobile = fileURLToPath(new URL('../apps/mobile/', import.meta.url));

export async function assertAndroidApiReady(value, request = fetch) {
  const url = productionApiUrl(value);
  const response = await request(`${url}/health/ready`, {
    signal: AbortSignal.timeout(10000),
    redirect: 'error',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Public API readiness returned HTTP ${response.status}.`);
  const body = await response.json();
  if (body?.service !== 'fintrack-api' || body?.status !== 'ok' || body?.scope !== 'database') {
    throw new Error('Public API did not confirm database readiness.');
  }
  return url;
}

export function buildAndroid(environment, run = spawnSync) {
  const executable = process.platform === 'win32' ? 'eas.cmd' : 'eas';
  const result = run(
    executable,
    ['build', '--platform', 'android', '--profile', 'preview', '--wait'],
    {
      cwd: mobile,
      env: { ...environment, FINTRACK_RELEASE: '1' },
      stdio: 'inherit',
      windowsHide: true,
      shell: process.platform === 'win32',
    },
  );
  if (result.error) throw new Error('Could not start EAS CLI. Check its installation and login.');
  if (result.status !== 0) throw new Error('Android APK build failed; no release was confirmed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const environment = releaseEnvironment();
    const url = await assertAndroidApiReady(environment.EXPO_PUBLIC_API_URL);
    console.log(`Public API and database are reachable at ${url}. Starting Android APK build.`);
    buildAndroid(environment);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
