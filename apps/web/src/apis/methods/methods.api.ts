import type {
  AddEmailMethodRequestInterface,
  AuthMethodsResponseInterface,
} from '@nest-aws-starter/shared';
import { apiClient } from '../../utils/apiClient';

export function fetchMethods(): Promise<AuthMethodsResponseInterface> {
  return apiClient.get<AuthMethodsResponseInterface>('/auth/methods');
}

export function addEmailMethod(body: AddEmailMethodRequestInterface): Promise<void> {
  return apiClient.post<void>('/auth/methods/email', body);
}

export function unlinkMethod(type: string): Promise<void> {
  return apiClient.delete<void>(`/auth/methods/${type}`);
}
