import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { loginSchema, registerSchema } from '@fintrack/shared';
import { PrismaService } from '../database/prisma.service.js';
import { PasswordHasher } from './password.js';
import { createSession } from './sessions.js';

@Injectable()
export class AuthService {
  private readonly passwords = new PasswordHasher();

  constructor(private readonly prisma: PrismaService) {}

  async register(input: unknown) {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const passwordHash = await this.passwords.hash(parsed.data.password);
    try {
      return await this.prisma.db.user.create({
        data: { email: parsed.data.email, passwordHash },
        select: { id: true, email: true },
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('An account with this email already exists.');
      }
      throw error;
    }
  }

  async login(input: unknown) {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);

    const user = await this.prisma.db.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, passwordHash: true },
    });
    const validPassword = await this.passwords.verify(
      parsed.data.password,
      user?.passwordHash ?? null,
    );
    if (!user || !validPassword) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }

    const session = createSession(user.id, parsed.data.deviceName, new Date());
    await this.prisma.db.$transaction(async (transaction) => {
      await transaction.session.create({ data: session.session });
      await transaction.refreshToken.create({ data: session.refresh });
    });
    return {
      userId: user.id,
      sessionId: session.session.id,
      accessToken: session.credentials.accessToken,
      refreshToken: session.credentials.refreshToken,
      expiresAt: session.session.accessExpiresAt.toISOString(),
    };
  }
}
