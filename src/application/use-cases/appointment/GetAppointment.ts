import { IAppointmentRepository } from '../../../domain/repositories/IAppointmentRepository'
import { AppointmentResponseDTO } from '../../dtos/AppointmentDTO'
import { AppointmentMapper } from '../../../interfaces/mappers/AppointmentMapper'

export class GetAppointmentUseCase {
  constructor(private readonly appointmentRepository: IAppointmentRepository) {}

  async execute(id: string, userId: string): Promise<AppointmentResponseDTO> {
    const appointment = await this.appointmentRepository.findById(id)

    if (!appointment) {
      throw new Error('Appointment not found')
    }

    if (appointment.userId !== userId) {
      throw new Error('Appointment not found')
    }

    return AppointmentMapper.toResponseDTO(appointment)
  }
}
