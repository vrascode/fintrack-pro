import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { createDatabaseAdapter } from './adapter.js';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly client: PrismaClient | null;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    this.client = connectionString
      ? new PrismaClient({
          adapter: createDatabaseAdapter(connectionString),
        })
      : null;
  }

  get db(): PrismaClient {
    if (!this.client) {
      throw new ServiceUnavailableException('Database is not configured.');
    }
    return this.client;
  }

  async isDatabaseReady(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect();
  }
}
