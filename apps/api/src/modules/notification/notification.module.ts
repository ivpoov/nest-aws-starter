import { NotificationGateway } from '@modules/notification/gateways/notification.gateway.js';
import { Module } from '@nestjs/common';

// TokenService is injected directly — TokenModule is @Global(), so no
// import is needed here (same as JwtAuthGuard). PR 3 adds the dispatcher +
// history API to this same module — the gateway is deliberately the only
// thing shipped here for now (see task-2 brief). NotificationGateway is
// exported (not just the usual service) because PR 3's dispatcher needs
// its `server` to emit into the `user:<id>`/`admins` rooms this gateway
// joins sockets to.
@Module({
  providers: [NotificationGateway],
  exports: [NotificationGateway],
})
export class NotificationModule {}
