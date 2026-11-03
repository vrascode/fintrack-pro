import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';

// Single-process protection for the local API. Production replicas require a
// shared limiter and an explicitly trusted proxy configuration.
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, { count: number; until: number }>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ ip?: string }>();
    const response = context
      .switchToHttp()
      .getResponse<{ setHeader(name: string, value: string): void }>();
    const now = Date.now();
    for (const [key, bucket] of this.buckets) if (bucket.until <= now) this.buckets.delete(key);
    const key = request.ip ?? 'unknown';
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= 10000)
        throw new HttpException('Authentication is busy. Try again later.', 429);
      bucket = { count: 0, until: now + 60000 };
      this.buckets.set(key, bucket);
    }
    if (++bucket.count > 30) {
      response.setHeader('Retry-After', String(Math.ceil((bucket.until - now) / 1000)));
      throw new HttpException('Too many authentication attempts. Try again later.', 429);
    }
    return true;
  }
}
