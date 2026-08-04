import { API_KEY_INVALID } from '@modules/api-key/constants/api-key-errors.constants.js';
import type { ApiKeyPrincipalInterface } from '@modules/api-key/interfaces/api-key-principal.interface.js';
import { ApiKeyService } from '@modules/api-key/services/api-key.service.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

// Reads X-Api-Key, validates it against ApiKeyService, and attaches a
// service principal to the request (request.apiKey — never request.user,
// there is no human behind an API-key-authenticated call). Used via
// @RequireApiKey(), which also opts the route out of the global JWT guard.
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: FastifyRequest & { apiKey?: ApiKeyPrincipalInterface } = context
      .switchToHttp()
      .getRequest();
    const header: string | string[] | undefined = request.headers['x-api-key'];
    const rawKey: string | undefined = typeof header === 'string' ? header : undefined;

    if (!rawKey) throw new UnauthorizedError(API_KEY_INVALID);

    request.apiKey = await this.apiKeyService.validateKey(rawKey);

    return true;
  }
}
