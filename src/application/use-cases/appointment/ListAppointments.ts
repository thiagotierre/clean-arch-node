import { IAppointmentRepository } from '../../../domain/repositories/IAppointmentRepository'
import { ListAppointmentsDTO, AppointmentResponseDTO } from '../../dtos/AppointmentDTO'
import { AppointmentMapper } from '../../../interfaces/mappers/AppointmentMapper'

export class ListAppointmentsUseCase {
  constructor(private readonly appointmentRepository: IAppointmentRepository) {}

  async execute(dto: ListAppointmentsDTO): Promise<AppointmentResponseDTO[]> {
    const appointments = await this.appointmentRepository.findByUserId({
      userId: dto.userId,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      status: dto.status,
    })

    return appointments.map(AppointmentMapper.toResponseDTO)
  }
}
