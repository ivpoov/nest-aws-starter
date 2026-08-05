import { CaslModule } from '@modules/casl/casl.module.js';
import { NOTIFICATION_REPOSITORY } from '@modules/notification/constants/notification.constants.js';
import { NOTIFICATION_PREFERENCE_REPOSITORY } from '@modules/notification/constants/notification-preference.constants.js';
import { NotificationController } from '@modules/notification/controllers/notification.controller.js';
import { NotificationPreferenceController } from '@modules/notification/controllers/notification-preference.controller.js';
import { NotificationGateway } from '@modules/notification/gateways/notification.gateway.js';
import { notificationPermissions } from '@modules/notification/permissions/notification.permissions.js';
import { NotificationPreferencePrismaRepository } from '@modules/notification/repositories/notification-preference-prisma.repository.js';
import { NotificationPrismaRepository } from '@modules/notification/repositories/notification-prisma.repository.js';
import { NotificationService } from '@modules/notification/services/notification.service.js';
import { NotificationDispatcherService } from '@modules/notification/services/notification-dispatcher.service.js';
import { NotificationEmailService } from '@modules/notification/services/notification-email.service.js';
import { NotificationPreferenceService } from '@modules/notification/services/notification-preference.service.js';
import { UserModule } from '@modules/user/user.module.js';
import { Module } from '@nestjs/common';

// TokenService is injected directly — TokenModule is @Global(), so no
// import is needed here (same as JwtAuthGuard). NotificationDispatcherService
// is the module's only @OnDomainEvent subscriber (PR 3) — it depends on
// NotificationGateway directly (same module, no need for a contract) and on
// the repository via its injection token. NotificationController (PR 4)
// serves both roles from one set of endpoints, resolved by
// NotificationService against the caller's id/role. NotificationGateway
// stays exported for the dispatcher and any future consumer that needs
// `server`. UserModule is imported for NotificationEmailService's recipient
// lookup — `user` is a core module (docs/removal/README.md), so this is a
// core dependency, not a feature-to-feature import. CacheModule/MailModule
// are @Global(), so CacheFactoryService/MAIL_TRANSPORT need no import here
// (PR 5).
@Module({
  imports: [CaslModule.forFeature({ permissions: notificationPermissions }), UserModule],
  controllers: [NotificationController, NotificationPreferenceController],
  providers: [
    NotificationGateway,
    NotificationDispatcherService,
    NotificationEmailService,
    NotificationPreferenceService,
    NotificationService,
    { provide: NOTIFICATION_REPOSITORY, useClass: NotificationPrismaRepository },
    {
      provide: NOTIFICATION_PREFERENCE_REPOSITORY,
      useClass: NotificationPreferencePrismaRepository,
    },
  ],
  exports: [NotificationGateway],
})
export class NotificationModule {}
