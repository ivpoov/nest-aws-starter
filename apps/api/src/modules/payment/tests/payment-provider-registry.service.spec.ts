import type { PaymentProviderInterface } from '@modules/payment/interfaces/payment-provider.interface.js';
import { PaymentProviderRegistryService } from '@modules/payment/services/payment-provider-registry.service.js';
import { describe, expect, it } from 'vitest';

function fakeProvider(name: string): PaymentProviderInterface {
  return {
    name,
    createCheckoutSession: async () => ({ url: `https://fake.provider/${name}/checkout` }),
    createPortalSession: async () => `https://fake.provider/${name}/portal`,
    verifyAndParseWebhook: async () => {
      throw new Error('not exercised by this test');
    },
  };
}

describe('PaymentProviderRegistryService', () => {
  it('returns nothing when no provider is registered', () => {
    const registry = new PaymentProviderRegistryService();

    expect(registry.get('STRIPE')).toBeNull();
    expect(registry.getDefault()).toBeNull();
    expect(registry.enabledNames()).toEqual([]);
  });

  it('registers a provider and retrieves it by name', () => {
    const registry = new PaymentProviderRegistryService();
    const stripe = fakeProvider('STRIPE');

    registry.register(stripe);

    expect(registry.get('STRIPE')).toBe(stripe);
    expect(registry.enabledNames()).toEqual(['STRIPE']);
  });

  it('getDefault returns the first registered provider', () => {
    const registry = new PaymentProviderRegistryService();
    const first = fakeProvider('STRIPE');
    const second = fakeProvider('PAYPAL');

    registry.register(first);
    registry.register(second);

    expect(registry.getDefault()).toBe(first);
    expect(registry.enabledNames()).toEqual(['STRIPE', 'PAYPAL']);
  });
});
