export interface SnsProviderInterface {
  publish(topicArn: string, message: object): Promise<string>;
}
