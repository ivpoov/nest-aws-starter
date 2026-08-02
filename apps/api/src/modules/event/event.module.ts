import { EventBusService } from '@modules/event/services/event-bus.service.js';
import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventModule {}
