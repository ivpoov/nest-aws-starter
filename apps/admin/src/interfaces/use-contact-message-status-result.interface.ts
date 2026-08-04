import type {
  ApiErrorInterface,
  ContactMessageResponseInterface,
  ContactMessageStatusEnum,
} from '@nest-aws-starter/shared';

export interface UseContactMessageStatusResultInterface {
  readonly updateStatus: (
    id: string,
    status: ContactMessageStatusEnum,
  ) => Promise<ContactMessageResponseInterface | null>;
  readonly isPending: boolean;
  readonly error: ApiErrorInterface | null;
}
