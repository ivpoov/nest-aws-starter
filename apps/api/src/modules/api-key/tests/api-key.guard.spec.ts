import { ApiKeyGuard } from '@modules/api-key/guards/api-key.guard.js';
import type { ApiKeyPrincipalInterface } from '@modules/api-key/interfaces/api-key-principal.interface.js';
import type { ApiKeyService } from '@modules/api-key/services/api-key.service.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

const principal: ApiKeyPrincipalInterface = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  name: 'CI deploy bot',
  ownerId: '01890a5d-0000-774b-bcce-b30209990001',
};

function createContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  it('validates the X-Api-Key header and attaches request.apiKey', async () => {
    const validateKey = vi.fn().mockResolvedValue(principal);
    const apiKeyService = { validateKey } as unknown as ApiKeyService;
    const guard = new ApiKeyGuard(apiKeyService);
    const request: Record<string, unknown> = { headers: { 'x-api-key': 'sk_valid' } };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(validateKey).toHaveBeenCalledWith('sk_valid');
    expect(request.apiKey).toEqual(principal);
  });

  it('rejects a request with no X-Api-Key header', async () => {
    const validateKey = vi.fn();
    const apiKeyService = { validateKey } as unknown as ApiKeyService;
    const guard = new ApiKeyGuard(apiKeyService);
    const request: Record<string, unknown> = { headers: {} };

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(validateKey).not.toHaveBeenCalled();
  });

  it('propagates the service rejection for a missing/revoked key', async () => {
    const validateKey = vi.fn().mockRejectedValue(
      new UnauthorizedError({
        code: 'API_KEY_INVALID',
        details: 'invalid',
      }),
    );
    const apiKeyService = { validateKey } as unknown as ApiKeyService;
    const guard = new ApiKeyGuard(apiKeyService);
    const request: Record<string, unknown> = { headers: { 'x-api-key': 'sk_revoked' } };

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});
