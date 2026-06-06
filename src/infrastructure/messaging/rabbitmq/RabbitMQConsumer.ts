import { ConsumeMessage } from 'amqplib'
import { getRabbitMQClient } from './RabbitMQClient'

export interface QueueConfig {
  queueName: string
  deadLetterExchange?: string
  maxRetries?: number
  messageTtl?: number
}

export type MessageHandler = (
  content: Record<string, unknown>,
  message: ConsumeMessage,
) => Promise<void>

export class RabbitMQConsumer {
  async consume(config: QueueConfig, handler: MessageHandler): Promise<void> {
    const client = getRabbitMQClient()
    const channel = await client.getChannel()

    await channel.assertQueue(config.queueName, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': config.deadLetterExchange ?? 'agenda.dlx',
        'x-message-ttl': config.messageTtl ?? 86_400_000,
        'x-max-length': 100_000,
      },
    })

    await channel.bindQueue(config.queueName, client.exchangeName, `${config.queueName.replace('agenda.', '')}.*`)

    channel.prefetch(10)

    await channel.consume(config.queueName, async (message) => {
      if (!message) return

      try {
        const content = JSON.parse(message.content.toString()) as Record<string, unknown>
        await handler(content, message)
        channel.ack(message)
      } catch (error) {
        const retryCount = (message.properties.headers?.['x-retry-count'] as number) ?? 0
        const maxRetries = config.maxRetries ?? 3

        if (retryCount >= maxRetries) {
          channel.nack(message, false, false)
        } else {
          channel.nack(message, false, true)
        }
      }
    })
  }
}
