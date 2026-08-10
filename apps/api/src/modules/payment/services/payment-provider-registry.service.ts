import type { PaymentProviderInterface } from '@modules/payment/interfaces/payment-provider.interface.js';
import { Injectable } from '@nestjs/common';

// Provider modules (Stripe, others later) register themselves when
// their config is enabled — a disabled/unconfigured provider simply does not
// exist here. Mirrors OauthProviderRegistryService.
@Injectable()
export class PaymentProviderRegistryService {
  private readonly providers: Map<string, PaymentProviderInterface> = new Map();

  public register(provider: PaymentProviderInterface): void {
    this.providers.set(provider.name, provider);
  }

  public get(name: string): PaymentProviderInterface | null {
    return this.providers.get(name) ?? null;
  }

  // There is exactly one enabled payment provider at a time in this starter
  // — checkout/portal callers don't pick a provider, they just pay. Returns
  // whichever provider registered first (deterministic: only one ever will,
  // in practice) so `getDefault()` reads naturally at call sites.
  public getDefault(): PaymentProviderInterface | null {
    const [first] = this.providers.values();

    return first ?? null;
  }

  public enabledNames(): string[] {
    return [...this.providers.keys()];
  }
}
