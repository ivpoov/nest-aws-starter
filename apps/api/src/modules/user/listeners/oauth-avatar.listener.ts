import { USER_OAUTH_REGISTERED_EVENT } from '@modules/event/constants/event-names.constants.js';
import { OnDomainEvent } from '@modules/event/decorators/on-domain-event.decorator.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import type { OauthRegisteredPayloadInterface } from '@modules/user/interfaces/oauth-registered-payload.interface.js';
import { UserService } from '@modules/user/services/user.service.js';
import { Inject, Injectable } from '@nestjs/common';
import type { HttpDownloadResultInterface } from '@providers/http-client/interfaces/http-download-result.interface.js';
import { HttpClientService } from '@providers/http-client/services/http-client.service.js';
import { S3_PROVIDER } from '@providers/s3/constants/s3.constants.js';
import type { S3ProviderInterface } from '@providers/s3/interfaces/s3-provider.interface.js';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

@Injectable()
export class OauthAvatarListener {
  private readonly logger = new CustomLoggerService(OauthAvatarListener.name);

  constructor(
    private readonly httpClient: HttpClientService,
    @Inject(S3_PROVIDER) private readonly s3Provider: S3ProviderInterface,
    private readonly userService: UserService,
  ) {}

  // Best-effort: an avatar failure must never affect the signup that emitted it.
  @OnDomainEvent(USER_OAUTH_REGISTERED_EVENT)
  public async handle(payload: OauthRegisteredPayloadInterface): Promise<void> {
    if (!payload.avatarUrl) return;

    try {
      const download: HttpDownloadResultInterface = await this.httpClient.download(
        payload.avatarUrl,
        MAX_AVATAR_BYTES,
        ALLOWED_AVATAR_TYPES,
      );
      const avatarKey: string = await this.s3Provider.upload({
        key: `avatars/${payload.userId}`,
        body: download.body,
        contentType: download.contentType,
      });

      await this.userService.updateProfile(payload.userId, { avatarKey });
      this.logger.log(`Avatar synced for user ${payload.userId}`);
    } catch (caught) {
      this.logger.warn(`Avatar sync failed for user ${payload.userId}: ${String(caught)}`);
    }
  }
}
