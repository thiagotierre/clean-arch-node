import { IAppointmentRepository } from '../../../domain/repositories/IAppointmentRepository'
import { IMessagePublisher } from '../../interfaces/IMessagePublisher'
import { AppointmentReminderEvent } from '../../../domain/events/AppointmentReminderEvent'

const REMINDER_WINDOW_MINUTES = 60

export class SendRemindersUseCase {
  constructor(
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly messagePublisher: IMessagePublisher,
  ) {}

  async execute(): Promise<{ processed: number }> {
    const now = new Date()
    const from = new Date(now.getTime() + REMINDER_WINDOW_MINUTES * 60_000)
    const to = new Date(from.getTime() + 15 * 60_000)

    const appointments = await this.appointmentRepository.findUpcomingWithoutReminder(from, to)

    for (const appointment of appointments) {
      const minutesUntilStart = Math.round(
        (appointment.startDate.getTime() - now.getTime()) / 60_000,
      )

      const event = new AppointmentReminderEvent({
        appointmentId: appointment.id,
        title: appointment.title,
        startDate: appointment.startDate,
        contactId: appointment.contactId,
        userId: appointment.userId,
        minutesUntilStart,
      })

      await this.messagePublisher.publish(event, event.eventType)

      appointment.markReminderSent()
      await this.appointmentRepository.save(appointment)
    }

    return { processed: appointments.length }
  }
}
