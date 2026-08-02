import type { DomainEventInterface } from '@modules/event/interfaces/domain-event.interface.js';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class EventBusService {
  constructor(private readonly emitter: EventEmitter2) {}

  public emit(name: string, payload: DomainEventInterface): void {
    this.emitter.emit(name, payload);
  }
}
