import type {
  AdminUserListResponseInterface,
  AdminUserResponseInterface,
  RevokedSessionsResponseInterface,
  SessionResponseInterface,
  UserResponseInterface,
} from '@nest-aws-starter/shared';
import { apiClient } from '../../utils/apiClient';

export function fetchMe(): Promise<UserResponseInterface> {
  return apiClient.get<UserResponseInterface>('/users/me');
}

export function fetchAdminUsers(
  limit: number,
  cursor: string | null,
  search: string,
): Promise<AdminUserListResponseInterface> {
  const params: URLSearchParams = new URLSearchParams({ limit: String(limit) });

  if (cursor) params.set('cursor', cursor);

  if (search) params.set('search', search);

  return apiClient.get<AdminUserListResponseInterface>(`/admin/users?${params.toString()}`);
}

export function fetchAdminUser(id: string): Promise<AdminUserResponseInterface> {
  return apiClient.get<AdminUserResponseInterface>(`/admin/users/${id}`);
}

export function fetchAdminUserSessions(id: string): Promise<SessionResponseInterface[]> {
  return apiClient.get<SessionResponseInterface[]>(`/admin/users/${id}/sessions`);
}

export function revokeAdminUserSessions(id: string): Promise<RevokedSessionsResponseInterface> {
  return apiClient.delete<RevokedSessionsResponseInterface>(`/admin/users/${id}/sessions`);
}
