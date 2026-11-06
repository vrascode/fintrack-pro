import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';

@Catch()
export class DatabaseErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseErrorFilter.name);

  catch(error: unknown, host: ArgumentsHost) {
    const response = host
      .switchToHttp()
      .getResponse<{ status(code: number): { json(body: unknown): void } }>();
    if (error instanceof HttpException && error.getStatus() < 500) {
      response.status(error.getStatus()).json(error.getResponse());
      return;
    }
    if (error instanceof HttpException) {
      const body = error.getResponse();
      const readiness =
        error.getStatus() === 503 &&
        typeof body === 'object' &&
        'service' in body &&
        body.service === 'fintrack-api' &&
        'scope' in body &&
        body.scope === 'database' &&
        'status' in body &&
        body.status === 'unavailable';
      response.status(error.getStatus()).json(
        readiness
          ? {
              service: 'fintrack-api',
              scope: 'database',
              status: 'unavailable',
            }
          : {
              statusCode: error.getStatus(),
              message: 'The request could not be completed.',
            },
      );
      return;
    }
    const code =
      typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    const unavailable =
      /^(P100[0-2]|P101[017]|28P01|ECONNREFUSED|ETIMEDOUT)$/.test(code) ||
      (error instanceof Error &&
        ['PrismaClientInitializationError', 'DriverAdapterError'].includes(error.name));
    // Raw Prisma/driver errors can contain query parameters and URLs. Log no
    // exception payload, and return a stable public error for infrastructure loss.
    this.logger.error(unavailable ? 'Database unavailable' : 'Unhandled request failure');
    response.status(unavailable ? 503 : 500).json({
      statusCode: unavailable ? 503 : 500,
      message: unavailable
        ? 'Database unavailable. Check server configuration.'
        : 'The request could not be completed.',
    });
  }
}
