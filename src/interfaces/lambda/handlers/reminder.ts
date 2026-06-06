import { ScheduledEvent } from 'aws-lambda'
import { getContainer } from '../../../infrastructure/container/DIContainer'

export async function send(_event: ScheduledEvent): Promise<void> {
  const container = getContainer()
  const result = await container.sendReminders.execute()
  console.log(JSON.stringify({ message: 'Reminders processed', ...result }))
}
