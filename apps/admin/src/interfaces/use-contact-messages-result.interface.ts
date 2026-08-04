import type { ApiErrorInterface, ContactMessageResponseInterface } from '@nest-aws-starter/shared';

export interface UseContactMessagesResultInterface {
  readonly messages: ContactMessageResponseInterface[];
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly loadMore: () => Promise<void>;
  readonly reload: () => Promise<void>;
}
