export function resolveApiBaseUrl(
  configured: string | undefined,
  platform: string,
  development: boolean,
  webHostname?: string,
  nativeHostUri?: string | null,
): string {
  let developmentHost: string | undefined;
  if (development && platform !== 'web' && nativeHostUri) {
    try {
      const host = new URL(`http://${nativeHostUri}`).hostname;
      // Expo LAN connections reveal the computer address. Tunnels require an explicit API URL.
      if (
        /^\d+\.\d+\.\d+\.\d+$/.test(host) &&
        host.split('.').every((part) => Number(part) <= 255) &&
        /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
      )
        developmentHost = host;
    } catch {
      // Fall back to simulator defaults if Expo does not expose a LAN host.
    }
  }
  const value =
    configured?.trim() ||
    (development
      ? developmentHost
        ? `http://${developmentHost}:3000/v1`
        : platform === 'android'
          ? 'http://10.0.2.2:3000/v1'
          : `http://${platform === 'web' && webHostname ? webHostname : '127.0.0.1'}:3000/v1`
      : '');
  if (!value) throw new Error('EXPO_PUBLIC_API_URL must point to the deployed HTTPS API.');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL must be an absolute URL.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.replace(/\/$/, '') !== '/v1' ||
    (!development &&
      (url.protocol !== 'https:' ||
        ['localhost', '127.0.0.1', '[::1]', '10.0.2.2'].includes(url.hostname) ||
        !url.hostname.includes('.') ||
        /(^|\.)(local|internal|test|invalid|example)$/.test(url.hostname) ||
        /(^|\.)example\.(com|net|org)$/.test(url.hostname) ||
        /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)))
  ) {
    throw new Error('The API must use /v1; production requires a public HTTPS domain.');
  }
  // Cookies are host scoped: localhost and 127.0.0.1 are different sites.
  if (
    platform === 'web' &&
    development &&
    webHostname &&
    ['localhost', '127.0.0.1', '[::1]'].includes(webHostname) &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  )
    url.hostname = webHostname;
  if (
    platform !== 'web' &&
    development &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  ) {
    url.hostname = developmentHost ?? (platform === 'android' ? '10.0.2.2' : url.hostname);
  }
  return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
}
