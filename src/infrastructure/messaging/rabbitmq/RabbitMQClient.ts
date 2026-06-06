import amqplib, { Channel, Connection } from 'amqplib'

interface RabbitMQConfig {
  url: string
  exchange: string
  exchangeType?: string
}

export class RabbitMQClient {
  private connection: Connection | null = null
  private channel: Channel | null = null
  private readonly config: RabbitMQConfig

  constructor(config?: Partial<RabbitMQConfig>) {
    this.config = {
      url: config?.url ?? process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
      exchange: config?.exchange ?? process.env.RABBITMQ_EXCHANGE ?? 'agenda.events',
      exchangeType: config?.exchangeType ?? 'topic',
    }
  }

  async connect(): Promise<void> {
    if (this.channel) return

    this.connection = await amqplib.connect(this.config.url)
    this.channel = await this.connection.createChannel()

    await this.channel.assertExchange(this.config.exchange, this.config.exchangeType!, {
      durable: true,
    })
  }

  async getChannel(): Promise<Channel> {
    await this.connect()
    return this.channel!
  }

  async close(): Promise<void> {
    await this.channel?.close()
    await this.connection?.close()
    this.channel = null
    this.connection = null
  }

  get exchangeName(): string {
    return this.config.exchange
  }
}

let rabbitMQClient: RabbitMQClient | null = null

export function getRabbitMQClient(): RabbitMQClient {
  if (!rabbitMQClient) {
    rabbitMQClient = new RabbitMQClient()
  }
  return rabbitMQClient
}
