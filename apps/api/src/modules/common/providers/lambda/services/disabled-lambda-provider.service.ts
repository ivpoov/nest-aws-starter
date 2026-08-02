import { InternalError } from '@modules/common/errors/internal.error.js';
import { LAMBDA_PROVIDER_DISABLED } from '@providers/lambda/constants/lambda-errors.constants.js';
import type { LambdaProviderInterface } from '@providers/lambda/interfaces/lambda-provider.interface.js';

export class DisabledLambdaProviderService implements LambdaProviderInterface {
  public invoke<TPayload, TResult>(_functionName: string, _payload: TPayload): Promise<TResult> {
    throw new InternalError(LAMBDA_PROVIDER_DISABLED);
  }
}
