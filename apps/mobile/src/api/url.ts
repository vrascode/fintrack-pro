export function resolveApiBaseUrl(
  configured: string | undefined,
  platform: string,
  development: boolean,
): string {
  const value =
    configured?.trim() ||
    (development
      ? platform === 'android'
        ? 'http://10.0.2.2:3000/v1'
        : 'http://127.0.0.1:3000/v1'
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
    (!development &&
      (url.protocol !== 'https:' ||
        ['localhost', '127.0.0.1', '[::1]', '10.0.2.2'].includes(url.hostname)))
  ) {
    throw new Error('The production API must use HTTPS.');
  }
  return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
}
