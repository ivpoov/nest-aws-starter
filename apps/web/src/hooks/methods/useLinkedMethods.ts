import type {
  AddEmailMethodRequestInterface,
  ApiErrorInterface,
  AuthMethodResponseInterface,
  AuthMethodsResponseInterface,
} from '@nest-aws-starter/shared';
import { useCallback, useEffect, useState } from 'react';
import { addEmailMethod, fetchMethods, unlinkMethod } from '../../apis/methods';
import type { UseLinkedMethodsResultInterface } from '../../interfaces/use-linked-methods-result.interface';
import { toApiError } from '../../utils/toApiError';

export function useLinkedMethods(): UseLinkedMethodsResultInterface {
  const [methods, setMethods] = useState<AuthMethodResponseInterface[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorInterface | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response: AuthMethodsResponseInterface = await fetchMethods();

      setMethods(response.methods);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addEmail = useCallback(
    async (body: AddEmailMethodRequestInterface): Promise<boolean> => {
      setError(null);

      try {
        await addEmailMethod(body);
        await reload();

        return true;
      } catch (caught) {
        setError(toApiError(caught));

        return false;
      }
    },
    [reload],
  );

  const unlink = useCallback(
    async (type: string): Promise<boolean> => {
      setError(null);

      try {
        await unlinkMethod(type);
        await reload();

        return true;
      } catch (caught) {
        setError(toApiError(caught));

        return false;
      }
    },
    [reload],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { methods, isLoading, error, addEmail, unlink, reload };
}
