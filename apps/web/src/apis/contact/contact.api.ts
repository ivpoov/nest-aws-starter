import type { SubmitContactRequestInterface } from '../../interfaces/submit-contact-request.interface';
import { apiClient } from '../../utils/apiClient';

export function submitContact(body: SubmitContactRequestInterface): Promise<void> {
  return apiClient.post<void>('/contact', body, true);
}
