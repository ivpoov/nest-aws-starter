import { ErrorCategoryEnum } from '@modules/common/enums/error-category.enum.js';
import { AppError } from '@modules/common/errors/app.error.js';

export class NotFoundError extends AppError {
  public readonly category = ErrorCategoryEnum.NOT_FOUND;
}
