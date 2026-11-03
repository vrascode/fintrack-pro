import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';

type OriginEnvironment = { NODE_ENV?: string | undefined; CORS_ORIGINS?: string | undefined };

export function createOriginPolicy(environment: OriginEnvironment = process.env) {
  const configured = (environment.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  for (const origin of configured) {
    try {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) throw new Error();
    } catch {
      throw new Error('CORS_ORIGINS must contain comma-separated HTTP(S) origins without paths.');
    }
  }
  const development =
    environment.NODE_ENV === undefined || ['development', 'test'].includes(environment.NODE_ENV);
  return (origin: string | undefined): boolean => {
    if (!origin) return false; // Native requests do not need browser CORS permission.
    if (configured.includes(origin)) return true;
    if (!development) return false;
    try {
      const url = new URL(origin);
      return (
        url.origin === origin &&
        ['http:', 'https:'].includes(url.protocol) &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      );
    } catch {
      return false;
    }
  };
}

export function createCorsOptions(environment: OriginEnvironment = process.env): CorsOptions {
  const allowed = createOriginPolicy(environment);
  return {
    origin: (origin, callback) => callback(null, allowed(origin)),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Content-Type', 'Authorization', 'Idempotency-Key'],
    optionsSuccessStatus: 204,
  };
}
