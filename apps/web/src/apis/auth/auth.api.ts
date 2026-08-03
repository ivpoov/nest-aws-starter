import type {
  AuthTokensResponseInterface,
  ForgotPasswordRequestInterface,
  LoginRequestInterface,
  OauthExchangeResponseInterface,
  OauthProvidersResponseInterface,
  RegisterRequestInterface,
  ResetPasswordRequestInterface,
  VerifyEmailRequestInterface,
} from '@nest-aws-starter/shared';
import { apiClient } from '../../utils/apiClient';

export function register(body: RegisterRequestInterface): Promise<AuthTokensResponseInterface> {
  return apiClient.post<AuthTokensResponseInterface>('/auth/register', body, true);
}

export function login(body: LoginRequestInterface): Promise<AuthTokensResponseInterface> {
  return apiClient.post<AuthTokensResponseInterface>('/auth/login', body, true);
}

export function logout(): Promise<void> {
  return apiClient.post<void>('/auth/logout');
}

export function fetchProviders(): Promise<OauthProvidersResponseInterface> {
  return apiClient.get<OauthProvidersResponseInterface>('/auth/providers', true);
}

export function exchangeOauthCode(code: string): Promise<OauthExchangeResponseInterface> {
  return apiClient.post<OauthExchangeResponseInterface>('/auth/oauth/exchange', { code }, true);
}

export function requestEmailVerification(): Promise<void> {
  return apiClient.post<void>('/auth/email/verify-request');
}

export function verifyEmail(body: VerifyEmailRequestInterface): Promise<void> {
  return apiClient.post<void>('/auth/email/verify', body, true);
}

export function forgotPassword(body: ForgotPasswordRequestInterface): Promise<void> {
  return apiClient.post<void>('/auth/password/forgot', body, true);
}

export function resetPassword(body: ResetPasswordRequestInterface): Promise<void> {
  return apiClient.post<void>('/auth/password/reset', body, true);
}
