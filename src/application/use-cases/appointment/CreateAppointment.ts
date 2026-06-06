import { Appointment } from '../../../domain/entities/Appointment'
import { IAppointmentRepository } from '../../../domain/repositories/IAppointmentRepository'
import { IMessagePublisher } from '../../interfaces/IMessagePublisher'
import { CreateAppointmentDTO, AppointmentResponseDTO } from '../../dtos/AppointmentDTO'
import { AppointmentMapper } from '../../../interfaces/mappers/AppointmentMapper'

export class CreateAppointmentUseCase {
  constructor(
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly messagePublisher: IMessagePublisher,
  ) {}

  async execute(dto: CreateAppointmentDTO): Promise<AppointmentResponseDTO> {
    const appointment = Appointment.create({
      title: dto.title,
      description: dto.description,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      contactId: dto.contactId,
      userId: dto.userId,
    })

    await this.appointmentRepository.save(appointment)

    const domainEvents = appointment.pullDomainEvents()
    for (const event of domainEvents) {
      await this.messagePublisher.publish(event, event.eventType)
    }

    return AppointmentMapper.toResponseDTO(appointment)
  }
}
