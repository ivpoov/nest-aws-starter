import type { AuthTokensResponseInterface, LoginRequestInterface } from '@nest-aws-starter/shared';
import { apiClient } from '../../utils/apiClient';

export function login(body: LoginRequestInterface): Promise<AuthTokensResponseInterface> {
  return apiClient.post<AuthTokensResponseInterface>('/auth/login', body, true);
}

export function logout(): Promise<void> {
  return apiClient.post<void>('/auth/logout');
}
