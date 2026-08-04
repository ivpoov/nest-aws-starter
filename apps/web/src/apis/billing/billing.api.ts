import type {
  CheckoutResponseInterface,
  CreateCheckoutRequestInterface,
  PublicPlansResponseInterface,
  SubscriptionResponseInterface,
} from '@nest-aws-starter/shared';
import { apiClient } from '../../utils/apiClient';

export function fetchPublicPlans(): Promise<PublicPlansResponseInterface> {
  return apiClient.get<PublicPlansResponseInterface>('/billing/plans', true);
}

export function createCheckoutSession(
  body: CreateCheckoutRequestInterface,
): Promise<CheckoutResponseInterface> {
  return apiClient.post<CheckoutResponseInterface>('/billing/checkout', body);
}

export function fetchCurrentSubscription(): Promise<SubscriptionResponseInterface> {
  return apiClient.get<SubscriptionResponseInterface>('/billing/subscription');
}

export function cancelSubscription(): Promise<SubscriptionResponseInterface> {
  return apiClient.post<SubscriptionResponseInterface>('/billing/cancel');
}

export function createPortalSession(): Promise<CheckoutResponseInterface> {
  return apiClient.post<CheckoutResponseInterface>('/billing/portal');
}
