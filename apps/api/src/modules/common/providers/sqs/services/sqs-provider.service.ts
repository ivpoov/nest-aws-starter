import {
  DeleteMessageCommand,
  type Message,
  ReceiveMessageCommand,
  SendMessageCommand,
  type SendMessageCommandOutput,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import type { SqsMessageInterface } from '@providers/sqs/interfaces/sqs-message.interface.js';
import type { SqsProviderInterface } from '@providers/sqs/interfaces/sqs-provider.interface.js';
import type { EnabledSqsConfigType } from '@providers/sqs/types/enabled-sqs-config.type.js';

export class SqsProviderService implements SqsProviderInterface {
  private readonly logger = new CustomLoggerService(SqsProviderService.name);
  private readonly client: SQSClient;

  constructor(config: EnabledSqsConfigType) {
    this.client = new SQSClient({
      region: config.region,
      ...(config.endpoint && { endpoint: config.endpoint }),
    });
  }

  public async sendMessage(queueUrl: string, body: object): Promise<string> {
    const result: SendMessageCommandOutput = await this.client.send(
      new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(body) }),
    );
    const messageId: string = result.MessageId ?? '';

    this.logger.log(`SQS message sent: ${messageId}`);

    return messageId;
  }

  public async receiveMessages(
    queueUrl: string,
    maxMessages: number,
  ): Promise<SqsMessageInterface[]> {
    const result = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: 1,
      }),
    );
    const messages: Message[] = result.Messages ?? [];

    return messages.map(
      (message: Message): SqsMessageInterface => ({
        messageId: message.MessageId ?? '',
        receiptHandle: message.ReceiptHandle ?? '',
        body: message.Body ?? '',
      }),
    );
  }

  public async deleteMessage(queueUrl: string, receiptHandle: string): Promise<void> {
    await this.client.send(
      new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: receiptHandle }),
    );
  }
}
