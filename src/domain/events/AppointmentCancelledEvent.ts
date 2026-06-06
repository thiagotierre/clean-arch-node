import { DomainEvent } from './DomainEvent'

interface AppointmentCancelledPayload {
  appointmentId: string
  userId: string
  contactId: string
}

export class AppointmentCancelledEvent extends DomainEvent {
  readonly eventType = 'appointment.cancelled'
  readonly aggregateType = 'Appointment'
  private readonly payload: AppointmentCancelledPayload

  constructor(payload: AppointmentCancelledPayload) {
    super()
    this.payload = payload
  }

  protected getPayload(): Record<string, unknown> {
    return {
      appointmentId: this.payload.appointmentId,
      userId: this.payload.userId,
      contactId: this.payload.contactId,
    }
  }
}
