import { PUBLIC_METADATA_KEY } from '@constants/auth-metadata.constants.js';
import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import { AUTH_TOKEN_INVALID } from '@modules/token/constants/token-errors.constants.js';
import { OnlineUsersService } from '@modules/token/services/online-users.service.js';
import { TokenService } from '@modules/token/services/token.service.js';
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly onlineUsersService: OnlineUsersService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic: boolean | undefined = this.reflector.getAllAndOverride(PUBLIC_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request: FastifyRequest & { user?: CurrentUserInterface } = context
      .switchToHttp()
      .getRequest();
    const token: string | null = this.extractBearer(request);

    if (!token) throw new UnauthorizedError(AUTH_TOKEN_INVALID);

    request.user = await this.tokenService.verifyAccessToken(token);

    // Online-users gauge: best-effort presence touch, never blocks or fails
    // the request (OnlineUsersService swallows its own errors).
    await this.onlineUsersService.touch(request.user.id);

    return true;
  }

  private extractBearer(request: FastifyRequest): string | null {
    const header: string | undefined = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) return null;

    return header.slice('Bearer '.length);
  }
}
