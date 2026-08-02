import { InvokeCommand, type InvokeCommandOutput, LambdaClient } from '@aws-sdk/client-lambda';
import { InternalError } from '@modules/common/errors/internal.error.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { LAMBDA_INVOCATION_FAILED } from '@providers/lambda/constants/lambda-errors.constants.js';
import type { LambdaProviderInterface } from '@providers/lambda/interfaces/lambda-provider.interface.js';
import type { EnabledLambdaConfigType } from '@providers/lambda/types/enabled-lambda-config.type.js';

export class LambdaProviderService implements LambdaProviderInterface {
  private readonly logger = new CustomLoggerService(LambdaProviderService.name);
  private readonly client: LambdaClient;

  constructor(config: EnabledLambdaConfigType) {
    this.client = new LambdaClient({
      region: config.region,
      ...(config.endpoint && { endpoint: config.endpoint }),
    });
  }

  public async invoke<TPayload, TResult>(
    functionName: string,
    payload: TPayload,
  ): Promise<TResult> {
    const result: InvokeCommandOutput = await this.client.send(
      new InvokeCommand({
        FunctionName: functionName,
        Payload: Buffer.from(JSON.stringify(payload)),
      }),
    );

    if (result.FunctionError) {
      this.logger.error(`Lambda invocation failed: ${functionName} (${result.FunctionError})`);

      throw new InternalError(LAMBDA_INVOCATION_FAILED);
    }

    const raw: string = new TextDecoder().decode(result.Payload);

    this.logger.log(`Lambda invoked: ${functionName}`);

    return JSON.parse(raw) as TResult;
  }
}
