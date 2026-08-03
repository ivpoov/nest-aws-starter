import type { OauthProviderInterface } from '@modules/oauth/interfaces/oauth-provider.interface.js';
import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';
import { Injectable } from '@nestjs/common';

// Provider modules (google/facebook/discord) register themselves when their
// config is enabled — unconfigured providers simply do not exist here.
@Injectable()
export class OauthProviderRegistryService {
  private readonly providers: Map<AuthMethodTypeEnum, OauthProviderInterface> = new Map();

  public register(provider: OauthProviderInterface): void {
    this.providers.set(provider.type, provider);
  }

  public get(type: AuthMethodTypeEnum): OauthProviderInterface | null {
    return this.providers.get(type) ?? null;
  }

  public enabledTypes(): AuthMethodTypeEnum[] {
    return [...this.providers.keys()];
  }
}
