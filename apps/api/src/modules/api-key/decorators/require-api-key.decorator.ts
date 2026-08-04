import { Public } from '@decorators/public.decorator.js';
import { ApiKeyGuard } from '@modules/api-key/guards/api-key.guard.js';
import { applyDecorators, UseGuards } from '@nestjs/common';

// The composition pattern for any API-key-guarded endpoint: it opts out of
// the global JwtAuthGuard (@Public()) and opts into ApiKeyGuard instead —
// "otherwise public, but api-key required". Use this alone for routes that
// only need the key check; routes that also need the per-key rate budget
// additionally add @UseGuards(ApiKeyThrottlerGuard) — see
// ApiDemoController.whoami() for the full pattern and why guard order
// matters there.
export function RequireApiKey(): MethodDecorator & ClassDecorator {
  return applyDecorators(Public(), UseGuards(ApiKeyGuard));
}
