import { CaslModule } from '@modules/casl/casl.module.js';
import { NOTIFICATION_REPOSITORY } from '@modules/notification/constants/notification.constants.js';
import { NotificationController } from '@modules/notification/controllers/notification.controller.js';
import { NotificationGateway } from '@modules/notification/gateways/notification.gateway.js';
import { notificationPermissions } from '@modules/notification/permissions/notification.permissions.js';
import { NotificationPrismaRepository } from '@modules/notification/repositories/notification-prisma.repository.js';
import { NotificationService } from '@modules/notification/services/notification.service.js';
import { NotificationDispatcherService } from '@modules/notification/services/notification-dispatcher.service.js';
import { Module } from '@nestjs/common';

// TokenService is injected directly — TokenModule is @Global(), so no
// import is needed here (same as JwtAuthGuard). NotificationDispatcherService
// is the module's only @OnDomainEvent subscriber (PR 3) — it depends on
// NotificationGateway directly (same module, no need for a contract) and on
// the repository via its injection token. NotificationController (PR 4)
// serves both roles from one set of endpoints, resolved by
// NotificationService against the caller's id/role. NotificationGateway
// stays exported for the dispatcher and any future consumer that needs
// `server`.
@Module({
  imports: [CaslModule.forFeature({ permissions: notificationPermissions })],
  controllers: [NotificationController],
  providers: [
    NotificationGateway,
    NotificationDispatcherService,
    NotificationService,
    { provide: NOTIFICATION_REPOSITORY, useClass: NotificationPrismaRepository },
  ],
  exports: [NotificationGateway],
})
export class NotificationModule {}
