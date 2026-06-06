import { DomainEvent } from '../../../domain/events/DomainEvent'
import { IMessagePublisher } from '../../../application/interfaces/IMessagePublisher'
import { getRabbitMQClient } from './RabbitMQClient'

export class RabbitMQPublisher implements IMessagePublisher {
  async publish(event: DomainEvent, routingKey: string): Promise<void> {
    const client = getRabbitMQClient()
    const channel = await client.getChannel()

    const message = Buffer.from(JSON.stringify(event.toJSON()))

    channel.publish(client.exchangeName, routingKey, message, {
      persistent: true,
      contentType: 'application/json',
      messageId: event.eventId,
      timestamp: event.occurredAt.getTime(),
      headers: {
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        version: event.version,
      },
    })
  }

  async publishBatch(events: DomainEvent[], routingKey: string): Promise<void> {
    for (const event of events) {
      await this.publish(event, routingKey)
    }
  }
}
