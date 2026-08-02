import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { SNS_PROVIDER } from '@providers/sns/constants/sns.constants.js';
import type { SnsProviderInterface } from '@providers/sns/interfaces/sns-provider.interface.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

const topicArn = 'arn:aws:sns:us-east-1:000000000000:starter-topic';

describe('SNS provider (LocalStack)', () => {
  let app: NestFastifyApplication;
  let sns: SnsProviderInterface;

  beforeAll(async () => {
    app = await createTestApp();
    sns = app.get<SnsProviderInterface>(SNS_PROVIDER);
  });

  afterAll(async () => {
    await app.close();
  });

  it('publishes to the init topic and returns a message id', async () => {
    const messageId: string = await sns.publish(topicArn, { kind: 'e2e' });

    expect(messageId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
