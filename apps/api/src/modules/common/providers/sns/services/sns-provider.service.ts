import { PublishCommand, type PublishCommandOutput, SNSClient } from '@aws-sdk/client-sns';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import type { SnsProviderInterface } from '@providers/sns/interfaces/sns-provider.interface.js';
import type { EnabledSnsConfigType } from '@providers/sns/types/enabled-sns-config.type.js';

export class SnsProviderService implements SnsProviderInterface {
  private readonly logger = new CustomLoggerService(SnsProviderService.name);
  private readonly client: SNSClient;

  constructor(config: EnabledSnsConfigType) {
    this.client = new SNSClient({
      region: config.region,
      ...(config.endpoint && { endpoint: config.endpoint }),
    });
  }

  public async publish(topicArn: string, message: object): Promise<string> {
    const result: PublishCommandOutput = await this.client.send(
      new PublishCommand({ TopicArn: topicArn, Message: JSON.stringify(message) }),
    );
    const messageId: string = result.MessageId ?? '';

    this.logger.log(`SNS message published: ${messageId}`);

    return messageId;
  }
}
