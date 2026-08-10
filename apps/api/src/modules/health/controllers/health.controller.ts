import { Public } from '@decorators/public.decorator.js';
import { HealthStatusResponseDto } from '@modules/health/dtos/responses/health-status-response.dto.js';
import { LivenessStatusResponseDto } from '@modules/health/dtos/responses/liveness-status-response.dto.js';
import type { HealthStatusInterface } from '@modules/health/interfaces/health-status.interface.js';
import type { LivenessStatusInterface } from '@modules/health/interfaces/liveness-status.interface.js';
import { HealthService } from '@modules/health/services/health.service.js';
import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';

// Public + unthrottled: load balancers and orchestrators poll these
@Public()
@SkipThrottle()
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  // No `default` error response on either probe: these two routes never emit
  // the coded error envelope every other endpoint documents via
  // @ApiDefaultResponse. Liveness cannot fail without the process being gone,
  // and readiness reports a failed dependency as a 503 carrying the same body
  // as the 200 — which is exactly what a probe needs to read.
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Answers as long as the process is up. Never touches a dependency.',
  })
  @ApiResponse({ status: StatusCodes.OK, type: LivenessStatusResponseDto })
  @Get('live')
  public checkLiveness(): LivenessStatusInterface {
    return { status: 'ok' };
  }

  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Checks Postgres and Redis. Returns 503 when either is down.',
  })
  @ApiResponse({
    status: StatusCodes.OK,
    description: 'Every dependency answered.',
    type: HealthStatusResponseDto,
  })
  @ApiResponse({
    status: StatusCodes.SERVICE_UNAVAILABLE,
    description: 'At least one dependency is down — `status` is `degraded`.',
    type: HealthStatusResponseDto,
  })
  @Get('ready')
  public async checkReadiness(
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<HealthStatusInterface> {
    const health: HealthStatusInterface = await this.healthService.checkReadiness();

    if (health.status === 'degraded') {
      reply.status(StatusCodes.SERVICE_UNAVAILABLE);
    }

    return health;
  }
}
