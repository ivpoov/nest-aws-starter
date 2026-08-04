import { ADMIN_SCOPE_METADATA_KEY } from '@modules/casl/constants/casl.constants.js';
import { SetMetadata } from '@nestjs/common';

// Class-level marker for controllers under /admin/* — the only signal
// AccessGuard uses to deny impersonated sessions, independent of the HTTP
// path or the global API prefix/version.
export function AdminScope(): ClassDecorator {
  return SetMetadata(ADMIN_SCOPE_METADATA_KEY, true);
}
