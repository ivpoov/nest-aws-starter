import type { LivenessStatusInterface } from '@modules/health/interfaces/liveness-status.interface.js';
import { ApiProperty } from '@nestjs/swagger';

// Documentation-only, unlike the response DTOs elsewhere in this codebase: the
// health probes deliberately do not go through @Serialize, because a load
// balancer polls them several times a minute and an interceptor round-trip per
// poll buys nothing. `implements LivenessStatusInterface` is what keeps the
// published schema honest — change the interface and this stops compiling.
export class LivenessStatusResponseDto implements LivenessStatusInterface {
  @ApiProperty({ type: String, enum: ['ok'], example: 'ok' })
  readonly status: 'ok';
}
