import 'reflect-metadata';
import { Controller, Get, Header, Module, ServiceUnavailableException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { healthSchema, type Health } from '@fintrack/shared';
import { PrismaModule } from './database/prisma.module.js';
import { PrismaService } from './database/prisma.service.js';
import { AuthModule } from './identity/auth.module.js';

@Controller('health')
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  getHealth(): Health {
    return healthSchema.parse({ service: 'fintrack-api', status: 'ok', scope: 'process' });
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async getReadiness() {
    const ready = await this.prisma.isDatabaseReady();
    if (!ready)
      throw new ServiceUnavailableException({
        service: 'fintrack-api',
        status: 'unavailable',
        scope: 'database',
      });
    return { service: 'fintrack-api', status: 'ok', scope: 'database' };
  }
}

@Module({ imports: [PrismaModule, AuthModule], controllers: [HealthController] })
class AppModule {}

export async function createApp(logger: false | undefined = undefined) {
  const app = await NestFactory.create(AppModule, {
    logger: logger === false ? false : ['error', 'warn', 'log'],
  });
  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();
  return app;
}
