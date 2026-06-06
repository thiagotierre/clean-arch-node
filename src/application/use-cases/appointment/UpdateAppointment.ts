import { IAppointmentRepository } from '../../../domain/repositories/IAppointmentRepository'
import { UpdateAppointmentDTO, AppointmentResponseDTO } from '../../dtos/AppointmentDTO'
import { AppointmentMapper } from '../../../interfaces/mappers/AppointmentMapper'

export class UpdateAppointmentUseCase {
  constructor(private readonly appointmentRepository: IAppointmentRepository) {}

  async execute(dto: UpdateAppointmentDTO): Promise<AppointmentResponseDTO> {
    const appointment = await this.appointmentRepository.findById(dto.id)

    if (!appointment) {
      throw new Error('Appointment not found')
    }

    if (appointment.userId !== dto.userId) {
      throw new Error('Appointment not found')
    }

    if (dto.title || dto.description !== undefined) {
      appointment.updateDetails(dto.title ?? appointment.title, dto.description)
    }

    if (dto.startDate && dto.endDate) {
      appointment.reschedule(new Date(dto.startDate), new Date(dto.endDate))
    }

    await this.appointmentRepository.save(appointment)

    return AppointmentMapper.toResponseDTO(appointment)
  }
}
