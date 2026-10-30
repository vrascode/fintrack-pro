import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { loginSchema, registerSchema } from '@fintrack/shared';
import { PrismaService } from '../database/prisma.service.js';
import { PasswordHasher } from './password.js';
import { createSession, rotateSession } from './sessions.js';
import { tokenDigest } from './tokens.js';

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

  async logout(sessionId: string) {
    await this.prisma.db.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async restore(rawToken: string) {
    const tokenHash = tokenDigest(rawToken, 'refresh');
    if (!tokenHash) throw new UnauthorizedException();
    const result = await this.prisma.db.$transaction(async (db) => {
      const known = await db.refreshToken.findUnique({ where: { tokenHash } });
      if (!known) return null;
      await db.$queryRaw`SELECT id FROM "Session" WHERE id = ${known.sessionId}::uuid FOR UPDATE`;
      const session = await db.session.findUnique({ where: { id: known.sessionId } });
      const refresh = await db.refreshToken.findUnique({ where: { tokenHash } });
      if (!session || !refresh) return null;
      const rotation = rotateSession(session, refresh, rawToken, new Date());
      if (rotation.status === 'invalid') return null;
      if (rotation.status === 'replay') {
        await db.session.update({
          where: { id: session.id },
          data: { revokedAt: rotation.session.revokedAt },
        });
        return null;
      }
      const { grant, consumed } = rotation;
      await db.refreshToken.update({
        where: { id: refresh.id },
        data: { consumedAt: consumed.consumedAt },
      });
      await db.session.update({ where: { id: session.id }, data: grant.session });
      await db.refreshToken.create({ data: grant.refresh });
      return {
        userId: session.userId,
        sessionId: session.id,
        ...grant.credentials,
        expiresAt: grant.session.accessExpiresAt.toISOString(),
      };
    });
    // Throw after the transaction commits so replay revocation is preserved.
    if (!result) throw new UnauthorizedException();
    return result;
  }
}
