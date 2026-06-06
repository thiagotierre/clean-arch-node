import { IAppointmentRepository } from '../../../domain/repositories/IAppointmentRepository'
import { IMessagePublisher } from '../../interfaces/IMessagePublisher'
import { AppointmentResponseDTO } from '../../dtos/AppointmentDTO'
import { AppointmentMapper } from '../../../interfaces/mappers/AppointmentMapper'

export class CancelAppointmentUseCase {
  constructor(
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly messagePublisher: IMessagePublisher,
  ) {}

  async execute(id: string, userId: string): Promise<AppointmentResponseDTO> {
    const appointment = await this.appointmentRepository.findById(id)

    if (!appointment) {
      throw new Error('Appointment not found')
    }

    if (appointment.userId !== userId) {
      throw new Error('Appointment not found')
    }

    appointment.cancel()
    await this.appointmentRepository.save(appointment)

    const domainEvents = appointment.pullDomainEvents()
    for (const event of domainEvents) {
      await this.messagePublisher.publish(event, event.eventType)
    }

    return AppointmentMapper.toResponseDTO(appointment)
  }
}
