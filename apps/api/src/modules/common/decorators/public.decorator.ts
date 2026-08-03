import { PUBLIC_METADATA_KEY } from '@constants/auth-metadata.constants.js';
import { SetMetadata } from '@nestjs/common';

// Every route is authenticated by default (global JwtAuthGuard); @Public() is
// the explicit, searchable opt-out.
export function Public(): MethodDecorator & ClassDecorator {
  return SetMetadata(PUBLIC_METADATA_KEY, true);
}
