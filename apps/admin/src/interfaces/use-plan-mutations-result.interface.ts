import type {
  AdminPlanResponseInterface,
  ApiErrorInterface,
  CreatePlanRequestInterface,
  UpdatePlanRequestInterface,
} from '@nest-aws-starter/shared';

export interface UsePlanMutationsResultInterface {
  readonly isSaving: boolean;
  readonly error: ApiErrorInterface | null;
  readonly create: (body: CreatePlanRequestInterface) => Promise<AdminPlanResponseInterface | null>;
  readonly update: (
    id: string,
    body: UpdatePlanRequestInterface,
  ) => Promise<AdminPlanResponseInterface | null>;
  readonly setActive: (id: string, isActive: boolean) => Promise<boolean>;
  readonly remove: (id: string) => Promise<boolean>;
  readonly clearError: () => void;
}
