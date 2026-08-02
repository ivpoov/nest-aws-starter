import { ErrorCategoryEnum } from '@modules/common/enums/error-category.enum.js';
import { AppError } from '@modules/common/errors/app.error.js';

export class ValidationError extends AppError {
  public readonly category = ErrorCategoryEnum.VALIDATION;
}
