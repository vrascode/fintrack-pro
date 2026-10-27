import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { passwordSchema } from '@fintrack/shared';

// OWASP scrypt baseline. Bound concurrent work so callers cannot exhaust memory.
const cost = { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 };
const prefix = 'scrypt$131072$8$1$';
const encodedPattern = /^scrypt\$131072\$8\$1\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{43})$/;

export class PasswordCapacityError extends Error {
  constructor() {
    super('Password verification capacity exceeded. Retry later.');
  }
}

export class PasswordHasher {
  private active = 0;

  constructor(private readonly maxConcurrent = 2) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 4) {
      throw new RangeError('Password concurrency must be between 1 and 4.');
    }
  }

  private async derive(password: string, salt: Buffer): Promise<Buffer> {
    if (this.active >= this.maxConcurrent) throw new PasswordCapacityError();
    this.active++;
    try {
      return await new Promise<Buffer>((resolve, reject) => {
        scrypt(password, salt, 32, cost, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });
    } finally {
      this.active--;
    }
  }

  async hash(password: string): Promise<string> {
    passwordSchema.parse(password);
    const salt = randomBytes(16);
    const digest = await this.derive(password, salt);
    return `${prefix}${salt.toString('base64url')}$${digest.toString('base64url')}`;
  }

  // A missing user still incurs the same expensive derivation. The service must
  // return a generic login error and add per-IP/account throttling before exposure.
  async verify(password: string, encoded: string | null): Promise<boolean> {
    if (!passwordSchema.safeParse(password).success) return false;
    const match = encoded?.match(encodedPattern);
    const salt = match?.[1] ? Buffer.from(match[1], 'base64url') : Buffer.alloc(16);
    const expected = match?.[2] ? Buffer.from(match[2], 'base64url') : Buffer.alloc(32);
    const actual = await this.derive(password, salt);
    const equal = timingSafeEqual(actual, expected);
    return Boolean(
      match &&
      salt.toString('base64url') === match[1] &&
      expected.toString('base64url') === match[2] &&
      equal,
    );
  }
}
