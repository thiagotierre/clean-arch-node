import { randomUUID } from 'crypto'
import { AppointmentStatus } from '../value-objects/AppointmentStatus'
import { DateRange } from '../value-objects/DateRange'
import { AppointmentCreatedEvent } from '../events/AppointmentCreatedEvent'
import { AppointmentCancelledEvent } from '../events/AppointmentCancelledEvent'
import { DomainEvent } from '../events/DomainEvent'

export interface AppointmentProps {
  id: string
  title: string
  description?: string
  dateRange: DateRange
  status: AppointmentStatus
  contactId: string
  userId: string
  reminderSent: boolean
  reminderSentAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface CreateAppointmentProps {
  title: string
  description?: string
  startDate: Date
  endDate: Date
  contactId: string
  userId: string
}

export class Appointment {
  private readonly _props: AppointmentProps
  private _domainEvents: DomainEvent[] = []

  private constructor(props: AppointmentProps) {
    this._props = props
  }

  static create(props: CreateAppointmentProps): Appointment {
    const dateRange = DateRange.create(props.startDate, props.endDate)

    const appointment = new Appointment({
      id: randomUUID(),
      title: props.title,
      description: props.description,
      dateRange,
      status: AppointmentStatus.SCHEDULED,
      contactId: props.contactId,
      userId: props.userId,
      reminderSent: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    appointment.addDomainEvent(
      new AppointmentCreatedEvent({
        appointmentId: appointment.id,
        title: appointment.title,
        startDate: appointment.startDate,
        contactId: appointment.contactId,
        userId: appointment.userId,
      }),
    )

    return appointment
  }

  static reconstitute(props: AppointmentProps): Appointment {
    return new Appointment(props)
  }

  cancel(): void {
    if (this._props.status === AppointmentStatus.CANCELLED) {
      throw new Error('Appointment is already cancelled')
    }
    if (this._props.status === AppointmentStatus.COMPLETED) {
      throw new Error('Cannot cancel a completed appointment')
    }

    this._props.status = AppointmentStatus.CANCELLED
    this._props.updatedAt = new Date()

    this.addDomainEvent(
      new AppointmentCancelledEvent({
        appointmentId: this.id,
        userId: this.userId,
        contactId: this.contactId,
      }),
    )
  }

  complete(): void {
    if (this._props.status !== AppointmentStatus.SCHEDULED) {
      throw new Error('Only scheduled appointments can be completed')
    }

    this._props.status = AppointmentStatus.COMPLETED
    this._props.updatedAt = new Date()
  }

  updateDetails(title: string, description?: string): void {
    this._props.title = title
    this._props.description = description
    this._props.updatedAt = new Date()
  }

  reschedule(startDate: Date, endDate: Date): void {
    if (this._props.status === AppointmentStatus.CANCELLED) {
      throw new Error('Cannot reschedule a cancelled appointment')
    }

    this._props.dateRange = DateRange.create(startDate, endDate)
    this._props.reminderSent = false
    this._props.reminderSentAt = undefined
    this._props.updatedAt = new Date()
  }

  markReminderSent(): void {
    this._props.reminderSent = true
    this._props.reminderSentAt = new Date()
    this._props.updatedAt = new Date()
  }

  private addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event)
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents]
    this._domainEvents = []
    return events
  }

  get id(): string { return this._props.id }
  get title(): string { return this._props.title }
  get description(): string | undefined { return this._props.description }
  get startDate(): Date { return this._props.dateRange.startDate }
  get endDate(): Date { return this._props.dateRange.endDate }
  get status(): AppointmentStatus { return this._props.status }
  get contactId(): string { return this._props.contactId }
  get userId(): string { return this._props.userId }
  get reminderSent(): boolean { return this._props.reminderSent }
  get reminderSentAt(): Date | undefined { return this._props.reminderSentAt }
  get createdAt(): Date { return this._props.createdAt }
  get updatedAt(): Date { return this._props.updatedAt }
}
