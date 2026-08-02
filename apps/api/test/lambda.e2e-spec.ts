import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CreateFunctionCommand, GetFunctionCommand, LambdaClient } from '@aws-sdk/client-lambda';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { LAMBDA_PROVIDER } from '@providers/lambda/constants/lambda.constants.js';
import type { LambdaProviderInterface } from '@providers/lambda/interfaces/lambda-provider.interface.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

const functionName = 'starter-example';
const endpoint: string = process.env.AWS_ENDPOINT_URL ?? 'http://localhost:4567';

async function deployExampleLambda(): Promise<void> {
  const client: LambdaClient = new LambdaClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    endpoint,
  });
  const handlerDir: string = resolve(import.meta.dirname, '../../../lambdas/example/src');
  const zipPath: string = join(mkdtempSync(join(tmpdir(), 'starter-lambda-')), 'fn.zip');

  execSync(`python3 -m zipfile -c ${zipPath} handler.mjs`, { cwd: handlerDir });

  try {
    await client.send(
      new CreateFunctionCommand({
        FunctionName: functionName,
        Runtime: 'nodejs22.x',
        Handler: 'handler.handler',
        Role: 'arn:aws:iam::000000000000:role/lambda-role',
        Code: { ZipFile: readFileSync(zipPath) },
      }),
    );
  } catch (caught) {
    if ((caught as Error).name !== 'ResourceConflictException') throw caught;
  }

  await waitUntilActive(client);
  client.destroy();
}

async function waitUntilActive(client: LambdaClient): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const fn = await client.send(new GetFunctionCommand({ FunctionName: functionName }));

    if (fn.Configuration?.State === 'Active') return;

    await new Promise((resolvePause) => setTimeout(resolvePause, 1000));
  }

  throw new Error('example lambda never became Active');
}

describe('Lambda invoker (LocalStack)', () => {
  let app: NestFastifyApplication;
  let lambda: LambdaProviderInterface;

  beforeAll(async () => {
    await deployExampleLambda();
    app = await createTestApp();
    lambda = app.get<LambdaProviderInterface>(LAMBDA_PROVIDER);
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('round-trips a payload through the echo function', async () => {
    const result: { echoed: { kind: string } } = await lambda.invoke(functionName, {
      kind: 'e2e',
    });

    expect(result).toEqual({ echoed: { kind: 'e2e' } });
  }, 60_000);
});
