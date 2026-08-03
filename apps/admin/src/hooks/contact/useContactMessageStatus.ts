import type {
  ApiErrorInterface,
  ContactMessageResponseInterface,
  ContactMessageStatusEnum,
} from '@nest-aws-starter/shared';
import { useCallback, useState } from 'react';
import { updateContactMessageStatus } from '../../apis/contact';
import type { UseContactMessageStatusResultInterface } from '../../interfaces/use-contact-message-status-result.interface';
import { toApiError } from '../../utils/toApiError';

export function useContactMessageStatus(): UseContactMessageStatusResultInterface {
  const [isPending, setIsPending] = useState<boolean>(false);
  const [error, setError] = useState<ApiErrorInterface | null>(null);

  const updateStatus = useCallback(
    async (
      id: string,
      status: ContactMessageStatusEnum,
    ): Promise<ContactMessageResponseInterface | null> => {
      setIsPending(true);
      setError(null);

      try {
        return await updateContactMessageStatus(id, status);
      } catch (caught) {
        setError(toApiError(caught));
        return null;
      } finally {
        setIsPending(false);
      }
    },
    [],
  );

  return { updateStatus, isPending, error };
}
