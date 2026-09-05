import { CaslModule } from '@modules/casl/casl.module.js';
import { NOTIFICATION_REPOSITORY } from '@modules/notification/constants/notification.constants.js';
import { NOTIFICATION_EMAIL_THROTTLE_REPOSITORY } from '@modules/notification/constants/notification-email-throttle.constants.js';
import { NOTIFICATION_PREFERENCE_REPOSITORY } from '@modules/notification/constants/notification-preference.constants.js';
import { NotificationController } from '@modules/notification/controllers/notification.controller.js';
import { NotificationPreferenceController } from '@modules/notification/controllers/notification-preference.controller.js';
import { NotificationGateway } from '@modules/notification/gateways/notification.gateway.js';
import { notificationPermissions } from '@modules/notification/permissions/notification.permissions.js';
import { NotificationEmailThrottleRedisRepository } from '@modules/notification/repositories/notification-email-throttle-redis.repository.js';
import { NotificationPreferencePrismaRepository } from '@modules/notification/repositories/notification-preference-prisma.repository.js';
import { NotificationPrismaRepository } from '@modules/notification/repositories/notification-prisma.repository.js';
import { NotificationService } from '@modules/notification/services/notification.service.js';
import { NotificationEmailService } from '@modules/notification/services/notification-email.service.js';
import { NotificationEventSubscriberService } from '@modules/notification/services/notification-event-subscriber.service.js';
import { NotificationFanOutService } from '@modules/notification/services/notification-fan-out.service.js';
import { NotificationPreferenceService } from '@modules/notification/services/notification-preference.service.js';
import { WebsocketHandshakeLimiterService } from '@modules/notification/services/websocket-handshake-limiter.service.js';
import { UserModule } from '@modules/user/user.module.js';
import { Module } from '@nestjs/common';

// TokenService is injected directly — TokenModule is @Global(), so no
// import is needed here (same as JwtAuthGuard). NotificationEventSubscriberService
// is the module's only @OnDomainEvent subscriber — it depends on
// NotificationGateway directly (same module, no need for a contract) and on
// the repository via its injection token. NotificationController
// serves both roles from one set of endpoints, resolved by
// NotificationService against the caller's id/role. NotificationGateway
// stays exported for the fan-out service and any future consumer that needs
// `server`. UserModule is imported for NotificationEmailService's recipient
// lookup — `user` is a core module (docs/removal/README.md), so this is a
// core dependency, not a feature-to-feature import. CacheModule/MailModule
// are @Global(), so CacheFactoryService/MAIL_TRANSPORT need no import here.
// NotificationFanOutService is the event subscriber's fan-out orchestrator
// (IN_APP/unread-count/EMAIL), extracted out of the event subscriber itself.
@Module({
  imports: [CaslModule.forFeature({ permissions: notificationPermissions }), UserModule],
  controllers: [NotificationController, NotificationPreferenceController],
  providers: [
    NotificationGateway,
    WebsocketHandshakeLimiterService,
    NotificationEventSubscriberService,
    NotificationEmailService,
    NotificationFanOutService,
    NotificationPreferenceService,
    NotificationService,
    { provide: NOTIFICATION_REPOSITORY, useClass: NotificationPrismaRepository },
    {
      provide: NOTIFICATION_PREFERENCE_REPOSITORY,
      useClass: NotificationPreferencePrismaRepository,
    },
    {
      provide: NOTIFICATION_EMAIL_THROTTLE_REPOSITORY,
      useClass: NotificationEmailThrottleRedisRepository,
    },
  ],
  exports: [NotificationGateway],
})
export class NotificationModule {}
