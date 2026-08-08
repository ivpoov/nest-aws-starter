import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import { AUTH_TOKEN_INVALID } from '@modules/token/constants/token-errors.constants.js';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

// The full principal (id + role, ...) — for handlers that branch on more
// than the id (e.g. an admin-vs-user merged feed). Prefer CurrentUserId when
// only the id is needed.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserInterface => {
    const request: FastifyRequest & { user?: CurrentUserInterface } = context
      .switchToHttp()
      .getRequest();

    if (!request.user) throw new UnauthorizedError(AUTH_TOKEN_INVALID);

    return request.user;
  },
);
