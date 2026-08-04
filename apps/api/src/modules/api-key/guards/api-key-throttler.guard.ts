import { ThrottlerBehindProxyGuard } from '@guards/throttler-behind-proxy.guard.js';
import { API_KEY_THROTTLER_NAME } from '@modules/api-key/constants/api-key.constants.js';
import type { ApiKeyPrincipalInterface } from '@modules/api-key/interfaces/api-key-principal.interface.js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';

const DEFAULT_LIMIT = 60;
const DEFAULT_TTL_MS = 60_000;

// Per-key rate budget, deliberately decoupled from the global ip-based
// 'default' throttler: it runs under its own throttler name
// (API_KEY_THROTTLER_NAME) with a baseline set here in onModuleInit()
// rather than inherited from the shared ThrottlerModuleOptions. That
// decoupling is load-bearing — the global ThrottlerBehindProxyGuard (an
// APP_GUARD) also runs on every request and iterates over every *named*
// throttler on the handler; if this guard reused the 'default' name, a
// @Throttle({ default: ... }) override meant only for the per-key budget
// would also apply to the global guard's ip tracker, and two different API
// keys hitting the same route from the same ip would share one ip-keyed
// counter instead of getting independent budgets.
//
// Guard order matters too: this guard's getTracker() reads request.apiKey,
// which only exists once ApiKeyGuard has run — it must be listed AFTER
// ApiKeyGuard in the route's guard chain (falls back to ip otherwise).
@Injectable()
export class ApiKeyThrottlerGuard extends ThrottlerBehindProxyGuard {
  // Explicit constructor keeps Nest's design:paramtypes metadata correct two
  // levels deep — ThrottlerBehindProxyGuard itself relies on inherited
  // @Inject metadata for `options`/`storage`, and dropping this constructor
  // risks TypeScript not emitting parameter metadata at all for a class
  // with no declared constructor of its own.
  // biome-ignore lint/complexity/noUselessConstructor: see comment above
  constructor(
    options: ThrottlerModuleOptions,
    storage: ThrottlerStorage,
    reflector: Reflector,
    configService: ConfigService,
  ) {
    super(options, storage, reflector, configService);
  }

  // Sets getTracker/generateKey directly on the throttler entry rather than
  // via `this.<method>.bind(this)` on commonOptions — the library's
  // ThrottlerGetTrackerFunction type takes `Record<string, any>`, which a
  // bound method reference typed FastifyRequest fails contravariantly;
  // contextually-typed arrow functions here sidestep that without an
  // explicit `any` in this file.
  public override async onModuleInit(): Promise<void> {
    this.throttlers = [
      {
        name: API_KEY_THROTTLER_NAME,
        limit: DEFAULT_LIMIT,
        ttl: DEFAULT_TTL_MS,
        getTracker: (request) =>
          this.getTracker(request as FastifyRequest & { apiKey?: ApiKeyPrincipalInterface }),
        generateKey: (context, tracker, name) => this.generateKey(context, tracker, name),
      },
    ];
    this.commonOptions = {};
  }

  protected override async getTracker(
    request: FastifyRequest & { apiKey?: ApiKeyPrincipalInterface },
  ): Promise<string> {
    if (request.apiKey) return `apikey:${request.apiKey.id}`;

    return super.getTracker(request);
  }
}
