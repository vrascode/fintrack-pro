import 'reflect-metadata';
import { Controller, Get, Header, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { healthSchema, type Health } from '@fintrack/shared';

@Controller('health')
class HealthController {
  @Get()
  @Header('Cache-Control', 'no-store')
  getHealth(): Health {
    return healthSchema.parse({ service: 'fintrack-api', status: 'ok', scope: 'process' });
  }
}

@Module({ controllers: [HealthController] })
class AppModule {}

export async function createApp(logger: false | undefined = undefined) {
  const app = await NestFactory.create(AppModule, {
    logger: logger === false ? false : ['error', 'warn', 'log'],
  });
  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();
  return app;
}
