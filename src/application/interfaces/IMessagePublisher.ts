import { DomainEvent } from '../../domain/events/DomainEvent'

export interface IMessagePublisher {
  publish(event: DomainEvent, routingKey: string): Promise<void>
  publishBatch(events: DomainEvent[], routingKey: string): Promise<void>
}
