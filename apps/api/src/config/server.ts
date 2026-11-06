type ServerEnvironment = {
  NODE_ENV?: string | undefined;
  PORT?: string | undefined;
  HOST?: string | undefined;
  DATABASE_URL?: string | undefined;
};

export function serverOptions(environment: ServerEnvironment = process.env) {
  const port = Number(environment.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be between 1 and 65535');
  const production = environment.NODE_ENV === 'production';
  if (production && !environment.DATABASE_URL?.trim())
    throw new Error('DATABASE_URL is required in production.');
  return {
    port,
    host: environment.HOST?.trim() || (production ? '0.0.0.0' : '127.0.0.1'),
  };
}
