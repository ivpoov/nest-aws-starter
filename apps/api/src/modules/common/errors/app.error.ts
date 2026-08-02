import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';
import type { ErrorCategoryEnum } from '@modules/common/enums/error-category.enum.js';

// Domain errors are transport-agnostic: services throw meaning (category + coded
// args); each transport edge (HTTP filter today, WS/gRPC filters later) owns the
// mapping from category to its protocol's status.
export abstract class AppError extends Error {
  public abstract readonly category: ErrorCategoryEnum;

  constructor(public readonly args: ErrorArgsInterface) {
    super(args.details);
    this.name = new.target.name;
  }
}
