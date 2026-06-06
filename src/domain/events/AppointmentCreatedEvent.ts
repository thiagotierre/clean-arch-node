import { DomainEvent } from './DomainEvent'

interface AppointmentCreatedPayload {
  appointmentId: string
  title: string
  startDate: Date
  contactId: string
  userId: string
}

export class AppointmentCreatedEvent extends DomainEvent {
  readonly eventType = 'appointment.created'
  readonly aggregateType = 'Appointment'
  private readonly payload: AppointmentCreatedPayload

  constructor(payload: AppointmentCreatedPayload) {
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
    }
  }
}
