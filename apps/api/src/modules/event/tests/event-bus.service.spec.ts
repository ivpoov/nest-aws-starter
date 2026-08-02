import { OnDomainEvent } from '@modules/event/decorators/on-domain-event.decorator.js';
import { EventModule } from '@modules/event/event.module.js';
import type { DomainEventInterface } from '@modules/event/interfaces/domain-event.interface.js';
import { EventBusService } from '@modules/event/services/event-bus.service.js';
import { Injectable } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

@Injectable()
class TestSubscriber {
  public received: DomainEventInterface | null = null;

  @OnDomainEvent('test.event')
  public handle(payload: DomainEventInterface): void {
    this.received = payload;
  }
}

describe('EventBusService', () => {
  it('delivers emitted payloads to subscribers', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [EventModule],
      providers: [TestSubscriber],
    }).compile();
    const app = moduleRef.createNestApplication(new FastifyAdapter());

    await app.init();

    const bus: EventBusService = app.get(EventBusService);
    const subscriber: TestSubscriber = app.get(TestSubscriber);

    bus.emit('test.event', { entityId: 'abc' });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(subscriber.received).toEqual({ entityId: 'abc' });

    await app.close();
  });
});
