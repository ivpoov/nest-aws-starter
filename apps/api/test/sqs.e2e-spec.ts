import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { SQS_PROVIDER } from '@providers/sqs/constants/sqs.constants.js';
import type { SqsMessageInterface } from '@providers/sqs/interfaces/sqs-message.interface.js';
import type { SqsProviderInterface } from '@providers/sqs/interfaces/sqs-provider.interface.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

const endpoint: string = process.env.AWS_ENDPOINT_URL ?? 'http://localhost:4567';
const queueUrl: string = `${endpoint}/000000000000/starter-queue`;

describe('SQS provider (LocalStack)', () => {
  let app: NestFastifyApplication;
  let sqs: SqsProviderInterface;

  beforeAll(async () => {
    app = await createTestApp();
    sqs = app.get<SqsProviderInterface>(SQS_PROVIDER);
  });

  afterAll(async () => {
    await app.close();
  });

  it('round-trips a message: send, receive, delete', async () => {
    const messageId: string = await sqs.sendMessage(queueUrl, { kind: 'e2e', value: 42 });

    expect(messageId).not.toBe('');

    const messages: SqsMessageInterface[] = await sqs.receiveMessages(queueUrl, 10);
    const received: SqsMessageInterface | undefined = messages.find(
      (message: SqsMessageInterface): boolean => message.messageId === messageId,
    );

    expect(received).toBeDefined();
    expect(JSON.parse(received?.body ?? '{}')).toEqual({ kind: 'e2e', value: 42 });

    await sqs.deleteMessage(queueUrl, received?.receiptHandle ?? '');

    const afterDelete: SqsMessageInterface[] = await sqs.receiveMessages(queueUrl, 10);

    expect(
      afterDelete.find((message: SqsMessageInterface): boolean => message.messageId === messageId),
    ).toBeUndefined();
  });
});
