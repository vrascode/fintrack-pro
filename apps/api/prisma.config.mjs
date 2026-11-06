import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Prisma 7 uses datasource.url for CLI commands; the running API keeps its pool.
  datasource: { url: process.env.DIRECT_URL || env('DATABASE_URL') },
});
