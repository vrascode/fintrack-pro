import { spawnSync } from 'node:child_process';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expoEnvironment } from './expo.mjs';

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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const environment = releaseEnvironment();
    console.log(
      'Public API configuration passed static release checks. Availability and TLS still require deployment validation.',
    );
    if (process.argv.includes('--web')) {
      const result = spawnSync(
        process.execPath,
        ['scripts/expo.mjs', 'export', '--platform', 'web'],
        {
          stdio: 'inherit',
          windowsHide: true,
          env: environment,
        },
      );
      if (result.error || result.status !== 0) throw new Error('Production Web export failed.');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
