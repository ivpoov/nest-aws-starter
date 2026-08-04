import { API_KEY_INVALID } from '@modules/api-key/constants/api-key-errors.constants.js';
import type { ApiKeyPrincipalInterface } from '@modules/api-key/interfaces/api-key-principal.interface.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

export const CurrentApiKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ApiKeyPrincipalInterface => {
    const request: FastifyRequest & { apiKey?: ApiKeyPrincipalInterface } = context
      .switchToHttp()
      .getRequest();

    if (!request.apiKey) throw new UnauthorizedError(API_KEY_INVALID);

    return request.apiKey;
  },
);
