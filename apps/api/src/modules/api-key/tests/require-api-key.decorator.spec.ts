import { PUBLIC_METADATA_KEY } from '@constants/auth-metadata.constants.js';
import { RequireApiKey } from '@modules/api-key/decorators/require-api-key.decorator.js';
import { ApiKeyGuard } from '@modules/api-key/guards/api-key.guard.js';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { describe, expect, it } from 'vitest';

describe('RequireApiKey', () => {
  it('marks the handler @Public() and attaches ApiKeyGuard', () => {
    class TestController {
      @RequireApiKey()
      public handler(): void {}
    }

    const isPublic: boolean = Reflect.getMetadata(
      PUBLIC_METADATA_KEY,
      TestController.prototype.handler,
    );
    const guards: unknown[] = Reflect.getMetadata(
      GUARDS_METADATA,
      TestController.prototype.handler,
    );

    expect(isPublic).toBe(true);
    expect(guards).toContain(ApiKeyGuard);
  });
});
