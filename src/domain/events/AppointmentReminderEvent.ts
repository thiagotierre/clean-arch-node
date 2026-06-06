import { DomainEvent } from './DomainEvent'

interface AppointmentReminderPayload {
  appointmentId: string
  title: string
  startDate: Date
  contactId: string
  userId: string
  minutesUntilStart: number
}

export class AppointmentReminderEvent extends DomainEvent {
  readonly eventType = 'appointment.reminder'
  readonly aggregateType = 'Appointment'
  private readonly payload: AppointmentReminderPayload

  constructor(payload: AppointmentReminderPayload) {
    super()
    this.payload = payload
  }

  protected getPayload(): Record<string, unknown> {
    return {
      appointmentId: this.payload.appointmentId,
      title: this.payload.title,
      startDate: this.payload.startDate.toISOString(),
      contactId: this.payload.contactId,
      userId: this.payload.userId,
      minutesUntilStart: this.payload.minutesUntilStart,
    }
  }
}
