import type {
  ApiErrorInterface,
  ContactMessageResponseInterface,
  ContactMessageStatusEnum,
} from '@nest-aws-starter/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchContactMessages } from '../../apis/contact';
import type { UseContactMessagesResultInterface } from '../../interfaces/use-contact-messages-result.interface';
import { toApiError } from '../../utils/toApiError';

const PAGE_SIZE = 20;

export function useContactMessages(
  status: ContactMessageStatusEnum | null,
): UseContactMessagesResultInterface {
  const [messages, setMessages] = useState<ContactMessageResponseInterface[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorInterface | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const cursorRef = useRef<string | null>(null);

  const loadPage = useCallback(
    async (isFresh: boolean): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const cursor: string | null = isFresh ? null : cursorRef.current;
        const page = await fetchContactMessages(PAGE_SIZE, cursor, status);

        cursorRef.current = page.nextCursor;
        setHasMore(page.nextCursor !== null);
        setMessages(
          (current: ContactMessageResponseInterface[]): ContactMessageResponseInterface[] =>
            isFresh ? page.items : [...current, ...page.items],
        );
      } catch (caught) {
        setError(toApiError(caught));
      } finally {
        setIsLoading(false);
      }
    },
    [status],
  );

  const loadMore = useCallback(async (): Promise<void> => loadPage(false), [loadPage]);
  const reload = useCallback(async (): Promise<void> => loadPage(true), [loadPage]);

  useEffect(() => {
    void loadPage(true);
  }, [loadPage]);

  return { messages, hasMore, isLoading, error, loadMore, reload };
}
