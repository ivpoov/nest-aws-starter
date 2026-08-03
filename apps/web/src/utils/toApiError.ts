import type { ApiErrorInterface } from '@nest-aws-starter/shared';

const FALLBACK: ApiErrorInterface = {
  statusCode: 0,
  code: 'NETWORK_ERROR',
  details: 'Could not reach the server',
  meta: undefined,
  timestamp: '',
  path: '',
};

export function toApiError(caught: unknown): ApiErrorInterface {
  if (typeof caught === 'object' && caught !== null && 'code' in caught && 'statusCode' in caught) {
    return caught as ApiErrorInterface;
  }

  return FALLBACK;
}
