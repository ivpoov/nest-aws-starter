import type {
  RevokedSessionsResponseInterface,
  SessionResponseInterface,
} from '@nest-aws-starter/shared';
import { apiClient } from '../../utils/apiClient';

export function fetchSessions(): Promise<SessionResponseInterface[]> {
  return apiClient.get<SessionResponseInterface[]>('/sessions');
}

export function revokeSession(id: string): Promise<void> {
  return apiClient.delete<void>(`/sessions/${id}`);
}

export function revokeOtherSessions(): Promise<RevokedSessionsResponseInterface> {
  return apiClient.delete<RevokedSessionsResponseInterface>('/sessions');
}
