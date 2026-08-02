import { ErrorCategoryEnum } from '@modules/common/enums/error-category.enum.js';
import { AppError } from '@modules/common/errors/app.error.js';

export class InternalError extends AppError {
  public readonly category = ErrorCategoryEnum.INTERNAL;
}
