import { CreateAppointmentUseCase } from '../../../src/application/use-cases/appointment/CreateAppointment'
import { Appointment } from '../../../src/domain/entities/Appointment'
import { IAppointmentRepository } from '../../../src/domain/repositories/IAppointmentRepository'
import { IMessagePublisher } from '../../../src/application/interfaces/IMessagePublisher'
import { DomainEvent } from '../../../src/domain/events/DomainEvent'

class InMemoryAppointmentRepository implements IAppointmentRepository {
  items: Appointment[] = []

  async save(appointment: Appointment): Promise<void> {
    const index = this.items.findIndex((a) => a.id === appointment.id)
    if (index >= 0) {
      this.items[index] = appointment
    } else {
      this.items.push(appointment)
    }
  }

  async findById(id: string): Promise<Appointment | null> {
    return this.items.find((a) => a.id === id) ?? null
  }

  async findByUserId(): Promise<Appointment[]> {
    return this.items
  }

  async findUpcomingWithoutReminder(): Promise<Appointment[]> {
    return []
  }

  async delete(id: string): Promise<void> {
    this.items = this.items.filter((a) => a.id !== id)
  }
}

class InMemoryMessagePublisher implements IMessagePublisher {
  publishedEvents: Array<{ event: DomainEvent; routingKey: string }> = []

  async publish(event: DomainEvent, routingKey: string): Promise<void> {
    this.publishedEvents.push({ event, routingKey })
  }

  async publishBatch(events: DomainEvent[], routingKey: string): Promise<void> {
    for (const event of events) {
      await this.publish(event, routingKey)
    }
  }
}

function makeFutureDate(offsetMinutes: number): string {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString()
}

describe('CreateAppointmentUseCase', () => {
  let repository: InMemoryAppointmentRepository
  let publisher: InMemoryMessagePublisher
  let useCase: CreateAppointmentUseCase

  beforeEach(() => {
    repository = new InMemoryAppointmentRepository()
    publisher = new InMemoryMessagePublisher()
    useCase = new CreateAppointmentUseCase(repository, publisher)
  })

  it('should create and persist an appointment', async () => {
    const result = await useCase.execute({
      title: 'Reunião de planejamento',
      startDate: makeFutureDate(60),
      endDate: makeFutureDate(120),
      contactId: 'contact-1',
      userId: 'user-1',
    })

    expect(result.id).toBeDefined()
    expect(result.title).toBe('Reunião de planejamento')
    expect(result.status).toBe('SCHEDULED')
    expect(repository.items).toHaveLength(1)
  })

  it('should publish appointment.created event after creation', async () => {
    await useCase.execute({
      title: 'Reunião',
      startDate: makeFutureDate(60),
      endDate: makeFutureDate(120),
      contactId: 'contact-1',
      userId: 'user-1',
    })

    expect(publisher.publishedEvents).toHaveLength(1)
    expect(publisher.publishedEvents[0].routingKey).toBe('appointment.created')
  })

  it('should return appointment DTO with correct shape', async () => {
    const result = await useCase.execute({
      title: 'Test',
      description: 'Desc',
      startDate: makeFutureDate(60),
      endDate: makeFutureDate(120),
      contactId: 'contact-1',
      userId: 'user-1',
    })

    expect(result).toMatchObject({
      title: 'Test',
      description: 'Desc',
      status: 'SCHEDULED',
      reminderSent: false,
      contactId: 'contact-1',
      userId: 'user-1',
    })
    expect(result.createdAt).toBeDefined()
    expect(result.updatedAt).toBeDefined()
  })
})
