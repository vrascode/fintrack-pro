import { isIP } from 'node:net';
import app from './app.json' with { type: 'json' };

// EAS resolves the selected environment before evaluating this config. A release
// must fail during configuration if the public API is missing or points locally.
if (
  process.env.FINTRACK_RELEASE === '1' ||
  process.env.VERCEL === '1' ||
  ['preview', 'production'].includes(process.env.EAS_BUILD_PROFILE)
) {
  const value = process.env.EXPO_PUBLIC_API_URL;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Set EXPO_PUBLIC_API_URL to the public HTTPS API ending in /v1.');
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.replace(/\/$/, '') !== '/v1' ||
    isIP(host.replace(/^\[|\]$/g, '')) ||
    !host.includes('.') ||
    /(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host) ||
    /(^|\.)example\.(com|net|org)$/.test(host)
  ) {
    throw new Error('Android release requires a public HTTPS API domain ending in /v1.');
  }
}

export default { expo: app.expo };
