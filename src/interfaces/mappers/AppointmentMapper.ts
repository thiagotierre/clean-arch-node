import { Appointment, AppointmentProps } from '../../domain/entities/Appointment'
import { AppointmentResponseDTO } from '../../application/dtos/AppointmentDTO'
import { AppointmentStatus } from '../../domain/value-objects/AppointmentStatus'
import { DateRange } from '../../domain/value-objects/DateRange'

export interface AppointmentDynamoItem {
  PK: string
  SK: string
  GSI1PK: string
  GSI1SK: string
  id: string
  title: string
  description?: string
  startDate: string
  endDate: string
  status: string
  contactId: string
  userId: string
  reminderSent: boolean
  reminderSentAt?: string
  createdAt: string
  updatedAt: string
  entityType: 'APPOINTMENT'
}

export class AppointmentMapper {
  static toResponseDTO(appointment: Appointment): AppointmentResponseDTO {
    return {
      id: appointment.id,
      title: appointment.title,
      description: appointment.description,
      startDate: appointment.startDate.toISOString(),
      endDate: appointment.endDate.toISOString(),
      status: appointment.status,
      contactId: appointment.contactId,
      userId: appointment.userId,
      reminderSent: appointment.reminderSent,
      createdAt: appointment.createdAt.toISOString(),
      updatedAt: appointment.updatedAt.toISOString(),
    }
  }

  static toDynamoItem(appointment: Appointment): AppointmentDynamoItem {
    return {
      PK: `USER#${appointment.userId}`,
      SK: `APPOINTMENT#${appointment.id}`,
      GSI1PK: appointment.userId,
      GSI1SK: appointment.startDate.toISOString(),
      id: appointment.id,
      title: appointment.title,
      description: appointment.description,
      startDate: appointment.startDate.toISOString(),
      endDate: appointment.endDate.toISOString(),
      status: appointment.status,
      contactId: appointment.contactId,
      userId: appointment.userId,
      reminderSent: appointment.reminderSent,
      reminderSentAt: appointment.reminderSentAt?.toISOString(),
      createdAt: appointment.createdAt.toISOString(),
      updatedAt: appointment.updatedAt.toISOString(),
      entityType: 'APPOINTMENT',
    }
  }

  static fromDynamoItem(item: AppointmentDynamoItem): Appointment {
    const props: AppointmentProps = {
      id: item.id,
      title: item.title,
      description: item.description,
      dateRange: DateRange.reconstitute(new Date(item.startDate), new Date(item.endDate)),
      status: item.status as AppointmentStatus,
      contactId: item.contactId,
      userId: item.userId,
      reminderSent: item.reminderSent,
      reminderSentAt: item.reminderSentAt ? new Date(item.reminderSentAt) : undefined,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    }

    return Appointment.reconstitute(props)
  }
}
