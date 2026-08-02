import { InternalError } from '@modules/common/errors/internal.error.js';
import { SNS_PROVIDER_DISABLED } from '@providers/sns/constants/sns-errors.constants.js';
import type { SnsProviderInterface } from '@providers/sns/interfaces/sns-provider.interface.js';

export class DisabledSnsProviderService implements SnsProviderInterface {
  public publish(_topicArn: string, _message: object): Promise<string> {
    throw new InternalError(SNS_PROVIDER_DISABLED);
  }
}
