import { InternalError } from '@modules/common/errors/internal.error.js';
import { SQS_PROVIDER_DISABLED } from '@providers/sqs/constants/sqs-errors.constants.js';
import type { SqsMessageInterface } from '@providers/sqs/interfaces/sqs-message.interface.js';
import type { SqsProviderInterface } from '@providers/sqs/interfaces/sqs-provider.interface.js';

export class DisabledSqsProviderService implements SqsProviderInterface {
  public sendMessage(_queueUrl: string, _body: object): Promise<string> {
    return this.throwDisabled();
  }

  public receiveMessages(_queueUrl: string, _maxMessages: number): Promise<SqsMessageInterface[]> {
    return this.throwDisabled();
  }

  public deleteMessage(_queueUrl: string, _receiptHandle: string): Promise<void> {
    return this.throwDisabled();
  }

  private throwDisabled(): never {
    throw new InternalError(SQS_PROVIDER_DISABLED);
  }
}
