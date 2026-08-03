import type { AppConfig } from '@configs/app.config.js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    super(options, storage, reflector);
  }

  // Behind a trusted proxy (ALB/CloudFront) the client ip lives in
  // X-Forwarded-For; direct connections keep the socket ip.
  protected override async getTracker(request: FastifyRequest): Promise<string> {
    const config: AppConfig = this.configService.getOrThrow<AppConfig>('app');
    const forwardedFor: string | string[] | undefined = request.headers['x-forwarded-for'];

    if (config.trustProxy && typeof forwardedFor === 'string' && forwardedFor.length > 0) {
      return forwardedFor.split(',')[0]?.trim() ?? request.ip;
    }

    return request.ip;
  }
}
