import type { AdminLoginAsPayloadInterface } from '@modules/activity/interfaces/admin-login-as-payload.interface.js';
import type { ApiKeyCreatedPayloadInterface } from '@modules/activity/interfaces/api-key-created-payload.interface.js';
import type { ApiKeyRevokedPayloadInterface } from '@modules/activity/interfaces/api-key-revoked-payload.interface.js';
import type { AuthLoginFailedPayloadInterface } from '@modules/activity/interfaces/auth-login-failed-payload.interface.js';
import type { AuthLoginPayloadInterface } from '@modules/activity/interfaces/auth-login-payload.interface.js';
import type { AuthLogoutPayloadInterface } from '@modules/activity/interfaces/auth-logout-payload.interface.js';
import type { AuthMethodLinkedPayloadInterface } from '@modules/activity/interfaces/auth-method-linked-payload.interface.js';
import type { AuthMethodUnlinkedPayloadInterface } from '@modules/activity/interfaces/auth-method-unlinked-payload.interface.js';
import type { AuthNewDevicePayloadInterface } from '@modules/activity/interfaces/auth-new-device-payload.interface.js';
import type { AuthPasswordChangedPayloadInterface } from '@modules/activity/interfaces/auth-password-changed-payload.interface.js';
import type { AuthSuspiciousLoginPayloadInterface } from '@modules/activity/interfaces/auth-suspicious-login-payload.interface.js';
import type { ContactReceivedPayloadInterface } from '@modules/activity/interfaces/contact-received-payload.interface.js';
import type { CreateActivityDataInterface } from '@modules/activity/interfaces/create-activity-data.interface.js';
import type { FileUploadedPayloadInterface } from '@modules/activity/interfaces/file-uploaded-payload.interface.js';
import type { UserBlockedPayloadInterface } from '@modules/activity/interfaces/user-blocked-payload.interface.js';
import type { UserOauthRegisteredPayloadInterface } from '@modules/activity/interfaces/user-oauth-registered-payload.interface.js';
import type { UserRegisteredPayloadInterface } from '@modules/activity/interfaces/user-registered-payload.interface.js';
import type { UserUnblockedPayloadInterface } from '@modules/activity/interfaces/user-unblocked-payload.interface.js';
import { ActivityService } from '@modules/activity/services/activity.service.js';
import {
  ADMIN_LOGIN_AS_EVENT,
  API_KEY_CREATED_EVENT,
  API_KEY_REVOKED_EVENT,
  AUTH_LOGIN_EVENT,
  AUTH_LOGIN_FAILED_EVENT,
  AUTH_LOGOUT_EVENT,
  AUTH_METHOD_LINKED_EVENT,
  AUTH_METHOD_UNLINKED_EVENT,
  AUTH_NEW_DEVICE_EVENT,
  AUTH_PASSWORD_CHANGED_EVENT,
  AUTH_SUSPICIOUS_LOGIN_EVENT,
  CONTACT_RECEIVED_EVENT,
  FILE_UPLOADED_EVENT,
  USER_BLOCKED_EVENT,
  USER_OAUTH_REGISTERED_EVENT,
  USER_REGISTERED_EVENT,
  USER_UNBLOCKED_EVENT,
} from '@modules/event/constants/event-names.constants.js';
import { OnDomainEvent } from '@modules/event/decorators/on-domain-event.decorator.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { ActivityTypeEnum, LockoutScopeEnum } from '@nest-aws-starter/shared';
import { Injectable } from '@nestjs/common';

// Feature services never call ActivityService directly — they emit domain
// events and this listener is the single place that turns them into rows.
@Injectable()
export class ActivityListener {
  private readonly logger = new CustomLoggerService(ActivityListener.name);

  constructor(private readonly activityService: ActivityService) {}

  @OnDomainEvent(USER_REGISTERED_EVENT)
  public async onUserRegistered(payload: UserRegisteredPayloadInterface): Promise<void> {
    await this.safeRecord({
      userId: payload.userId,
      type: ActivityTypeEnum.USER_REGISTERED,
      ip: payload.ip,
    });
  }

  @OnDomainEvent(USER_OAUTH_REGISTERED_EVENT)
  public async onUserOauthRegistered(payload: UserOauthRegisteredPayloadInterface): Promise<void> {
    await this.safeRecord({
      userId: payload.userId,
      type: ActivityTypeEnum.USER_OAUTH_REGISTERED,
    });
  }

  @OnDomainEvent(AUTH_LOGIN_EVENT)
  public async onAuthLogin(payload: AuthLoginPayloadInterface): Promise<void> {
    await this.safeRecord({
      userId: payload.userId,
      type: ActivityTypeEnum.AUTH_LOGIN,
      ip: payload.ip,
    });
  }

  @OnDomainEvent(AUTH_LOGIN_FAILED_EVENT)
  public async onAuthLoginFailed(payload: AuthLoginFailedPayloadInterface): Promise<void> {
    await this.safeRecord({
      type: ActivityTypeEnum.AUTH_LOGIN_FAILED,
      ip: payload.ip,
      meta: { email: payload.email },
    });
  }

  @OnDomainEvent(AUTH_LOGOUT_EVENT)
  public async onAuthLogout(payload: AuthLogoutPayloadInterface): Promise<void> {
    await this.safeRecord({
      userId: payload.userId,
      sessionId: payload.sessionId,
      type: ActivityTypeEnum.AUTH_LOGOUT,
    });
  }

  @OnDomainEvent(AUTH_PASSWORD_CHANGED_EVENT)
  public async onAuthPasswordChanged(payload: AuthPasswordChangedPayloadInterface): Promise<void> {
    await this.safeRecord({
      userId: payload.userId,
      sessionId: payload.sessionId,
      type: ActivityTypeEnum.AUTH_PASSWORD_CHANGED,
    });
  }

  @OnDomainEvent(AUTH_METHOD_LINKED_EVENT)
  public async onAuthMethodLinked(payload: AuthMethodLinkedPayloadInterface): Promise<void> {
    await this.safeRecord({
      userId: payload.userId,
      type: ActivityTypeEnum.AUTH_METHOD_LINKED,
      meta: { methodType: payload.type },
    });
  }

  @OnDomainEvent(AUTH_METHOD_UNLINKED_EVENT)
  public async onAuthMethodUnlinked(payload: AuthMethodUnlinkedPayloadInterface): Promise<void> {
    await this.safeRecord({
      userId: payload.userId,
      type: ActivityTypeEnum.AUTH_METHOD_UNLINKED,
      meta: { methodType: payload.type },
    });
  }

  @OnDomainEvent(USER_BLOCKED_EVENT)
  public async onUserBlocked(payload: UserBlockedPayloadInterface): Promise<void> {
    await this.safeRecord({
      userId: payload.userId,
      actorId: payload.actorId,
      type: ActivityTypeEnum.USER_BLOCKED,
      meta: payload.reason ? { reason: payload.reason } : undefined,
    });
  }

  @OnDomainEvent(USER_UNBLOCKED_EVENT)
  public async onUserUnblocked(payload: UserUnblockedPayloadInterface): Promise<void> {
    await this.safeRecord({
      userId: payload.userId,
      actorId: payload.actorId,
      type: ActivityTypeEnum.USER_UNBLOCKED,
      meta: payload.reason ? { reason: payload.reason } : undefined,
    });
  }

  @OnDomainEvent(AUTH_SUSPICIOUS_LOGIN_EVENT)
  public async onAuthSuspiciousLogin(payload: AuthSuspiciousLoginPayloadInterface): Promise<void> {
    await this.safeRecord({
      type: ActivityTypeEnum.AUTH_SUSPICIOUS_LOGIN,
      ip: payload.scope === LockoutScopeEnum.IP ? payload.value : null,
      meta: { scope: payload.scope, value: payload.value },
    });
  }

  @OnDomainEvent(AUTH_NEW_DEVICE_EVENT)
  public async onAuthNewDevice(payload: AuthNewDevicePayloadInterface): Promise<void> {
    await this.safeRecord({
      userId: payload.userId,
      type: ActivityTypeEnum.AUTH_NEW_DEVICE,
      ip: payload.ip,
      meta: { device: payload.device },
    });
  }

  @OnDomainEvent(ADMIN_LOGIN_AS_EVENT)
  public async onAdminLoginAs(payload: AdminLoginAsPayloadInterface): Promise<void> {
    await this.safeRecord({
      userId: payload.userId,
      actorId: payload.actorId,
      sessionId: payload.sessionId,
      type: ActivityTypeEnum.ADMIN_LOGIN_AS,
    });
  }

  @OnDomainEvent(CONTACT_RECEIVED_EVENT)
  public async onContactReceived(payload: ContactReceivedPayloadInterface): Promise<void> {
    await this.safeRecord({
      type: ActivityTypeEnum.CONTACT_RECEIVED,
      ip: payload.ip,
      meta: { contactMessageId: payload.contactMessageId },
    });
  }

  @OnDomainEvent(FILE_UPLOADED_EVENT)
  public async onFileUploaded(payload: FileUploadedPayloadInterface): Promise<void> {
    await this.safeRecord({
      userId: payload.userId,
      type: ActivityTypeEnum.FILE_UPLOADED,
      meta: { fileId: payload.fileId, intent: payload.intent },
    });
  }

  @OnDomainEvent(API_KEY_CREATED_EVENT)
  public async onApiKeyCreated(payload: ApiKeyCreatedPayloadInterface): Promise<void> {
    await this.safeRecord({
      actorId: payload.actorId,
      type: ActivityTypeEnum.API_KEY_CREATED,
      meta: { apiKeyId: payload.apiKeyId, name: payload.name },
    });
  }

  @OnDomainEvent(API_KEY_REVOKED_EVENT)
  public async onApiKeyRevoked(payload: ApiKeyRevokedPayloadInterface): Promise<void> {
    await this.safeRecord({
      actorId: payload.actorId,
      type: ActivityTypeEnum.API_KEY_REVOKED,
      meta: { apiKeyId: payload.apiKeyId },
    });
  }

  // EventBusService.emit() is fire-and-forget — EventEmitter2 does not await
  // async listeners, so a rejection here would otherwise become an unhandled
  // promise rejection on a hot auth path. An audit-log write failure must
  // never take down the request that emitted it (same rationale as
  // OauthAvatarListener's best-effort catch).
  private async safeRecord(data: CreateActivityDataInterface): Promise<void> {
    try {
      await this.activityService.record(data);
    } catch (caught) {
      const stack: string | undefined = caught instanceof Error ? caught.stack : undefined;

      this.logger.error(`Failed to record activity ${data.type}: ${String(caught)}`, stack);
    }
  }
}
