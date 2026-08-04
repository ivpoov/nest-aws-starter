import type {
  AdminPlanListResponseInterface,
  AdminPlanResponseInterface,
  CreatePlanRequestInterface,
  UpdatePlanActivationRequestInterface,
  UpdatePlanRequestInterface,
} from '@nest-aws-starter/shared';
import { apiClient } from '../../utils/apiClient';

export function fetchAdminPlans(
  limit: number,
  cursor: string | null,
): Promise<AdminPlanListResponseInterface> {
  const params: URLSearchParams = new URLSearchParams({ limit: String(limit) });

  if (cursor) params.set('cursor', cursor);

  return apiClient.get<AdminPlanListResponseInterface>(`/admin/plans?${params.toString()}`);
}

export function createAdminPlan(
  body: CreatePlanRequestInterface,
): Promise<AdminPlanResponseInterface> {
  return apiClient.post<AdminPlanResponseInterface>('/admin/plans', body);
}

export function updateAdminPlan(
  id: string,
  body: UpdatePlanRequestInterface,
): Promise<AdminPlanResponseInterface> {
  return apiClient.patch<AdminPlanResponseInterface>(`/admin/plans/${id}`, body);
}

export function updateAdminPlanActivation(
  id: string,
  body: UpdatePlanActivationRequestInterface,
): Promise<AdminPlanResponseInterface> {
  return apiClient.patch<AdminPlanResponseInterface>(`/admin/plans/${id}/activation`, body);
}

export function deleteAdminPlan(id: string): Promise<void> {
  return apiClient.delete<void>(`/admin/plans/${id}`);
}
