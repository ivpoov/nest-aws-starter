import { type StripeConfig, stripeConfig } from '@configs/stripe.config.js';
import { PaymentProviderRegistryService } from '@modules/payment/services/payment-provider-registry.service.js';
import { StripePaymentProvider } from '@modules/stripe/providers/stripe-payment.provider.js';
import { Module, type Provider } from '@nestjs/common';

const registrationProvider: Provider = {
  provide: Symbol('STRIPE_PAYMENT_REGISTRATION'),
  inject: [stripeConfig.KEY, PaymentProviderRegistryService],
  useFactory: (config: StripeConfig, registry: PaymentProviderRegistryService): boolean => {
    // Unconfigured: no provider registers — billing falls back to
    // PAYMENT_PROVIDER_NOT_ENABLED, same contract as an unregistered OAuth
    // provider.
    if (config.isEnabled) registry.register(new StripePaymentProvider(config));

    return config.isEnabled;
  },
};

@Module({
  providers: [registrationProvider],
})
export class StripeModule {}
