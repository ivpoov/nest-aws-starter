import { ErrorCategoryEnum } from '@modules/common/enums/error-category.enum.js';
import { StatusCodes } from 'http-status-codes';

// The HTTP edge's category mapping — the only place domain categories meet HTTP
// status numbers. WS/gRPC edges get their own maps next to their filters.
export const HTTP_STATUS_BY_ERROR_CATEGORY: Record<ErrorCategoryEnum, number> = {
  [ErrorCategoryEnum.VALIDATION]: StatusCodes.BAD_REQUEST,
  [ErrorCategoryEnum.UNAUTHORIZED]: StatusCodes.UNAUTHORIZED,
  [ErrorCategoryEnum.FORBIDDEN]: StatusCodes.FORBIDDEN,
  [ErrorCategoryEnum.NOT_FOUND]: StatusCodes.NOT_FOUND,
  [ErrorCategoryEnum.CONFLICT]: StatusCodes.CONFLICT,
  [ErrorCategoryEnum.INTERNAL]: StatusCodes.INTERNAL_SERVER_ERROR,
};
