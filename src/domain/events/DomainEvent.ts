import { randomUUID } from 'crypto'

export interface DomainEventProps {
  eventId?: string
  occurredAt?: Date
  version?: number
}

export abstract class DomainEvent {
  readonly eventId: string
  readonly occurredAt: Date
  readonly version: number
  abstract readonly eventType: string
  abstract readonly aggregateType: string

  constructor(props: DomainEventProps = {}) {
    this.eventId = props.eventId ?? randomUUID()
    this.occurredAt = props.occurredAt ?? new Date()
    this.version = props.version ?? 1
  }

  toJSON(): Record<string, unknown> {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      aggregateType: this.aggregateType,
      occurredAt: this.occurredAt.toISOString(),
      version: this.version,
      payload: this.getPayload(),
    }
  }

  protected abstract getPayload(): Record<string, unknown>
}
