export interface SqsMessageInterface {
  readonly messageId: string;
  readonly receiptHandle: string;
  readonly body: string;
}
