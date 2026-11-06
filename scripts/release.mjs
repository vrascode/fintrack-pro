import { spawnSync } from 'node:child_process';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expoEnvironment } from './expo.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

export function productionApiUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Set EXPO_PUBLIC_API_URL to the deployed HTTPS API, including /v1.');
  }
  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.replace(/\/$/, '') !== '/v1' ||
    isIP(hostname.replace(/^\[|\]$/g, '')) ||
    !hostname.includes('.') ||
    /(^|\.)(localhost|local|internal|test|invalid|example)$/.test(hostname) ||
    /(^|\.)example\.(com|net|org)$/.test(hostname)
  ) {
    throw new Error(
      'Release requires a public HTTPS API domain ending in /v1; local and placeholder endpoints are rejected.',
    );
  }
  return url.href.replace(/\/$/, '');
}

export function releaseEnvironment(environment = process.env, rootEnvPath) {
  const loaded = expoEnvironment(environment, rootEnvPath);
  return { ...loaded, EXPO_PUBLIC_API_URL: productionApiUrl(loaded.EXPO_PUBLIC_API_URL) };
}

export function exportWeb(environment, run = spawnSync) {
  const result = run(
    process.execPath,
    [resolve(root, 'scripts/expo.mjs'), 'export', '--platform', 'web'],
    {
      cwd: root,
      stdio: 'inherit',
      windowsHide: true,
      env: { ...environment, FINTRACK_RELEASE: '1' },
    },
  );
  if (result.error)
    throw new Error('Could not start production Web export.', { cause: result.error });
  if (result.status !== 0) {
    const error = new Error(
      result.signal
        ? `Production Web export terminated by ${result.signal}.`
        : 'Production Web export failed.',
    );
    error.exitCode =
      Number.isInteger(result.status) && result.status > 0 && result.status <= 255
        ? result.status
        : 1;
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const environment = releaseEnvironment();
    console.log(
      'Public API configuration passed static release checks. Availability and TLS still require deployment validation.',
    );
    if (process.argv.includes('--web')) {
      exportWeb(environment);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = error.exitCode ?? 1;
  }
}
