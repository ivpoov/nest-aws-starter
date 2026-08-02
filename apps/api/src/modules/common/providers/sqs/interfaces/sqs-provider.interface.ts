import type { SqsMessageInterface } from '@providers/sqs/interfaces/sqs-message.interface.js';

export interface SqsProviderInterface {
  sendMessage(queueUrl: string, body: object): Promise<string>;
  receiveMessages(queueUrl: string, maxMessages: number): Promise<SqsMessageInterface[]>;
  deleteMessage(queueUrl: string, receiptHandle: string): Promise<void>;
}
