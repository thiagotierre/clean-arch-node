import { Appointment } from '../entities/Appointment'

export interface ListAppointmentsFilter {
  userId: string
  startDate?: Date
  endDate?: Date
  status?: string
}

export interface IAppointmentRepository {
  save(appointment: Appointment): Promise<void>
  findById(id: string): Promise<Appointment | null>
  findByUserId(filter: ListAppointmentsFilter): Promise<Appointment[]>
  findUpcomingWithoutReminder(from: Date, to: Date): Promise<Appointment[]>
  delete(id: string): Promise<void>
}
