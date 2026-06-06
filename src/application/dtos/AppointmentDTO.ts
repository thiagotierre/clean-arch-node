import { AppointmentStatus } from '../../domain/value-objects/AppointmentStatus'

export interface CreateAppointmentDTO {
  title: string
  description?: string
  startDate: string
  endDate: string
  contactId: string
  userId: string
}

export interface UpdateAppointmentDTO {
  id: string
  userId: string
  title?: string
  description?: string
  startDate?: string
  endDate?: string
}

export interface ListAppointmentsDTO {
  userId: string
  startDate?: string
  endDate?: string
  status?: string
}

export interface AppointmentResponseDTO {
  id: string
  title: string
  description?: string
  startDate: string
  endDate: string
  status: AppointmentStatus
  contactId: string
  userId: string
  reminderSent: boolean
  createdAt: string
  updatedAt: string
}
