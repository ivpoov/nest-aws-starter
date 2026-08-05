import type {
  AdminPlanResponseInterface,
  ApiErrorInterface,
  CreatePlanRequestInterface,
  UpdatePlanRequestInterface,
} from '@nest-aws-starter/shared';
import { useCallback, useState } from 'react';
import {
  createAdminPlan,
  deleteAdminPlan,
  updateAdminPlan,
  updateAdminPlanActivation,
} from '../../apis/plans';
import type { UsePlanMutationsResultInterface } from '../../interfaces/use-plan-mutations-result.interface';
import { toApiError } from '../../utils/toApiError';

// Shared by the create/edit modal and the table row actions — one place
// owns the pending/error state for every plan mutation.
export function usePlanMutations(): UsePlanMutationsResultInterface {
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<ApiErrorInterface | null>(null);

  const create = useCallback(
    async (body: CreatePlanRequestInterface): Promise<AdminPlanResponseInterface | null> => {
      setIsSaving(true);
      setError(null);

      try {
        return await createAdminPlan(body);
      } catch (caught) {
        setError(toApiError(caught));
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const update = useCallback(
    async (
      id: string,
      body: UpdatePlanRequestInterface,
    ): Promise<AdminPlanResponseInterface | null> => {
      setIsSaving(true);
      setError(null);

      try {
        return await updateAdminPlan(id, body);
      } catch (caught) {
        setError(toApiError(caught));
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const setActive = useCallback(async (id: string, isActive: boolean): Promise<boolean> => {
    setIsSaving(true);
    setError(null);

    try {
      await updateAdminPlanActivation(id, { isActive });
      return true;
    } catch (caught) {
      setError(toApiError(caught));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    setIsSaving(true);
    setError(null);

    try {
      await deleteAdminPlan(id);
      return true;
    } catch (caught) {
      setError(toApiError(caught));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const clearError = useCallback((): void => setError(null), []);

  return { isSaving, error, create, update, setActive, remove, clearError };
}
