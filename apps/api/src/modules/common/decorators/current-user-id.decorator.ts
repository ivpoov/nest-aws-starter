import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import { AUTH_TOKEN_INVALID } from '@modules/token/constants/token-errors.constants.js';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request: FastifyRequest & { user?: CurrentUserInterface } = context
      .switchToHttp()
      .getRequest();

    if (!request.user) throw new UnauthorizedError(AUTH_TOKEN_INVALID);

    return request.user.id;
  },
);
