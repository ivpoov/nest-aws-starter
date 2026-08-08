export interface WebhookFailedPayloadInterface {
  readonly webhookEventId: string;
  readonly provider: string;
  readonly type: string;
  readonly attempts: number;
  readonly lastError: string | null;
}
