import type {
  AddEmailMethodRequestInterface,
  ApiErrorInterface,
  AuthMethodResponseInterface,
} from '@nest-aws-starter/shared';

export interface UseLinkedMethodsResultInterface {
  readonly methods: AuthMethodResponseInterface[];
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly addEmail: (body: AddEmailMethodRequestInterface) => Promise<boolean>;
  readonly unlink: (type: string) => Promise<boolean>;
  readonly reload: () => Promise<void>;
}
