import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { acceptsAccess } from './sessions.js';
import { tokenDigest } from './tokens.js';
import { PrismaService } from '../database/prisma.service.js';

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  userId?: string;
  sessionId?: string;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const bearer =
      typeof authorization === 'string' ? /^Bearer (.+)$/i.exec(authorization)?.[1] : null;
    const accessTokenHash = bearer ? tokenDigest(bearer, 'access') : null;
    if (!bearer || !accessTokenHash) throw new UnauthorizedException();

    const session = await this.prisma.db.session.findUnique({ where: { accessTokenHash } });
    if (!session || !acceptsAccess(session, bearer, new Date())) throw new UnauthorizedException();
    request.userId = session.userId;
    request.sessionId = session.id;
    return true;
  }
}
