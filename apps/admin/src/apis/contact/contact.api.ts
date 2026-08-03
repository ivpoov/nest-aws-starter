import type {
  ContactMessageListResponseInterface,
  ContactMessageResponseInterface,
  ContactMessageStatusEnum,
} from '@nest-aws-starter/shared';
import { apiClient } from '../../utils/apiClient';

export function fetchContactMessages(
  limit: number,
  cursor: string | null,
  status: ContactMessageStatusEnum | null,
): Promise<ContactMessageListResponseInterface> {
  const params: URLSearchParams = new URLSearchParams({ limit: String(limit) });

  if (cursor) params.set('cursor', cursor);

  if (status) params.set('status', status);

  return apiClient.get<ContactMessageListResponseInterface>(
    `/admin/contact-messages?${params.toString()}`,
  );
}

export function updateContactMessageStatus(
  id: string,
  status: ContactMessageStatusEnum,
): Promise<ContactMessageResponseInterface> {
  return apiClient.patch<ContactMessageResponseInterface>(`/admin/contact-messages/${id}/status`, {
    status,
  });
}
