import type { AuthLoginFailedPayloadInterface } from '@modules/activity/interfaces/auth-login-failed-payload.interface.js';
import type { AuthLoginPayloadInterface } from '@modules/activity/interfaces/auth-login-payload.interface.js';
import type { AuthLogoutPayloadInterface } from '@modules/activity/interfaces/auth-logout-payload.interface.js';
import type { AuthMethodLinkedPayloadInterface } from '@modules/activity/interfaces/auth-method-linked-payload.interface.js';
import type { AuthMethodUnlinkedPayloadInterface } from '@modules/activity/interfaces/auth-method-unlinked-payload.interface.js';
import type { AuthPasswordChangedPayloadInterface } from '@modules/activity/interfaces/auth-password-changed-payload.interface.js';
import type { UserOauthRegisteredPayloadInterface } from '@modules/activity/interfaces/user-oauth-registered-payload.interface.js';
import type { UserRegisteredPayloadInterface } from '@modules/activity/interfaces/user-registered-payload.interface.js';
import { ActivityService } from '@modules/activity/services/activity.service.js';
import {
  AUTH_LOGIN_EVENT,
  AUTH_LOGIN_FAILED_EVENT,
  AUTH_LOGOUT_EVENT,
  AUTH_METHOD_LINKED_EVENT,
  AUTH_METHOD_UNLINKED_EVENT,
  AUTH_PASSWORD_CHANGED_EVENT,
  USER_OAUTH_REGISTERED_EVENT,
  USER_REGISTERED_EVENT,
} from '@modules/event/constants/event-names.constants.js';
import { OnDomainEvent } from '@modules/event/decorators/on-domain-event.decorator.js';
import { ActivityTypeEnum } from '@nest-aws-starter/shared';
import { Injectable } from '@nestjs/common';

// Feature services never call ActivityService directly — they emit domain
// events and this listener is the single place that turns them into rows.
@Injectable()
export class ActivityListener {
  constructor(private readonly activityService: ActivityService) {}

  @OnDomainEvent(USER_REGISTERED_EVENT)
  public async onUserRegistered(payload: UserRegisteredPayloadInterface): Promise<void> {
    await this.activityService.record({
      userId: payload.userId,
      type: ActivityTypeEnum.USER_REGISTERED,
      ip: payload.ip,
    });
  }

  @OnDomainEvent(USER_OAUTH_REGISTERED_EVENT)
  public async onUserOauthRegistered(payload: UserOauthRegisteredPayloadInterface): Promise<void> {
    await this.activityService.record({
      userId: payload.userId,
      type: ActivityTypeEnum.USER_OAUTH_REGISTERED,
    });
  }

  @OnDomainEvent(AUTH_LOGIN_EVENT)
  public async onAuthLogin(payload: AuthLoginPayloadInterface): Promise<void> {
    await this.activityService.record({
      userId: payload.userId,
      type: ActivityTypeEnum.AUTH_LOGIN,
      ip: payload.ip,
    });
  }

  @OnDomainEvent(AUTH_LOGIN_FAILED_EVENT)
  public async onAuthLoginFailed(payload: AuthLoginFailedPayloadInterface): Promise<void> {
    await this.activityService.record({
      type: ActivityTypeEnum.AUTH_LOGIN_FAILED,
      ip: payload.ip,
      meta: { email: payload.email },
    });
  }

  @OnDomainEvent(AUTH_LOGOUT_EVENT)
  public async onAuthLogout(payload: AuthLogoutPayloadInterface): Promise<void> {
    await this.activityService.record({
      userId: payload.userId,
      sessionId: payload.sessionId,
      type: ActivityTypeEnum.AUTH_LOGOUT,
    });
  }

  @OnDomainEvent(AUTH_PASSWORD_CHANGED_EVENT)
  public async onAuthPasswordChanged(payload: AuthPasswordChangedPayloadInterface): Promise<void> {
    await this.activityService.record({
      userId: payload.userId,
      sessionId: payload.sessionId,
      type: ActivityTypeEnum.AUTH_PASSWORD_CHANGED,
    });
  }

  @OnDomainEvent(AUTH_METHOD_LINKED_EVENT)
  public async onAuthMethodLinked(payload: AuthMethodLinkedPayloadInterface): Promise<void> {
    await this.activityService.record({
      userId: payload.userId,
      type: ActivityTypeEnum.AUTH_METHOD_LINKED,
      meta: { methodType: payload.type },
    });
  }

  @OnDomainEvent(AUTH_METHOD_UNLINKED_EVENT)
  public async onAuthMethodUnlinked(payload: AuthMethodUnlinkedPayloadInterface): Promise<void> {
    await this.activityService.record({
      userId: payload.userId,
      type: ActivityTypeEnum.AUTH_METHOD_UNLINKED,
      meta: { methodType: payload.type },
    });
  }
}
