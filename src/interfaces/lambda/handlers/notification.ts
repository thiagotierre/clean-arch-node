import { SQSEvent, SQSBatchResponse } from 'aws-lambda'

interface DomainEventMessage {
  eventId: string
  eventType: string
  aggregateId: string
  aggregateType: string
  occurredAt: string
  payload: Record<string, unknown>
}

export async function process(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: { itemIdentifier: string }[] = []

  for (const record of event.Records) {
    try {
      const domainEvent = JSON.parse(record.body) as DomainEventMessage

      console.log(
        JSON.stringify({
          message: 'Processing notification event',
          eventId: domainEvent.eventId,
          eventType: domainEvent.eventType,
        }),
      )

      await handleNotification(domainEvent)
    } catch (error) {
      console.error(
        JSON.stringify({
          message: 'Failed to process notification',
          messageId: record.messageId,
          error: error instanceof Error ? error.message : String(error),
        }),
      )
      batchItemFailures.push({ itemIdentifier: record.messageId })
    }
  }

  return { batchItemFailures }
}

async function handleNotification(event: DomainEventMessage): Promise<void> {
  switch (event.eventType) {
    case 'appointment.created':
      console.log(JSON.stringify({ action: 'send_confirmation', payload: event.payload }))
      break
    case 'appointment.cancelled':
      console.log(JSON.stringify({ action: 'send_cancellation', payload: event.payload }))
      break
    case 'appointment.reminder':
      console.log(JSON.stringify({ action: 'send_reminder', payload: event.payload }))
      break
    default:
      console.log(JSON.stringify({ action: 'unhandled_event', eventType: event.eventType }))
  }
}
