import type { HealthStatusInterface } from '@modules/health/interfaces/health-status.interface.js';
import { ApiProperty } from '@nestjs/swagger';

// Documentation-only — see the note on LivenessStatusResponseDto. The same
// shape is returned on both 200 and 503; `status` is what tells them apart,
// and each dependency flag says which one was down.
export class HealthStatusResponseDto implements HealthStatusInterface {
  @ApiProperty({
    type: String,
    enum: ['ok', 'degraded'],
    example: 'ok',
    description: '`degraded` is served with 503 so an orchestrator takes the task out of rotation.',
  })
  readonly status: 'ok' | 'degraded';

  @ApiProperty({ type: Boolean, description: 'Postgres answered a probe query.' })
  readonly database: boolean;

  @ApiProperty({ type: Boolean, description: 'Redis answered a PING.' })
  readonly redis: boolean;
}
