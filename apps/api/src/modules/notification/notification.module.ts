import { NOTIFICATION_REPOSITORY } from '@modules/notification/constants/notification.constants.js';
import { NotificationGateway } from '@modules/notification/gateways/notification.gateway.js';
import { NotificationPrismaRepository } from '@modules/notification/repositories/notification-prisma.repository.js';
import { NotificationDispatcherService } from '@modules/notification/services/notification-dispatcher.service.js';
import { Module } from '@nestjs/common';

// TokenService is injected directly — TokenModule is @Global(), so no
// import is needed here (same as JwtAuthGuard). NotificationDispatcherService
// is the module's only @OnDomainEvent subscriber (PR 3) — it depends on
// NotificationGateway directly (same module, no need for a contract) and on
// the repository via its injection token. PR 4 (history API) adds
// controllers to this same module. NotificationGateway stays exported for
// the dispatcher and any future controller that needs `server`.
@Module({
  providers: [
    NotificationGateway,
    NotificationDispatcherService,
    { provide: NOTIFICATION_REPOSITORY, useClass: NotificationPrismaRepository },
  ],
  exports: [NotificationGateway],
})
export class NotificationModule {}
