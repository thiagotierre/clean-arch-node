import { Appointment } from '../../../src/domain/entities/Appointment'
import { AppointmentStatus } from '../../../src/domain/value-objects/AppointmentStatus'
import { AppointmentCreatedEvent } from '../../../src/domain/events/AppointmentCreatedEvent'

function makeFutureDate(offsetMinutes: number): Date {
  return new Date(Date.now() + offsetMinutes * 60_000)
}

describe('Appointment entity', () => {
  describe('create', () => {
    it('should create a scheduled appointment with correct props', () => {
      const startDate = makeFutureDate(60)
      const endDate = makeFutureDate(120)

      const appointment = Appointment.create({
        title: 'Reunião de alinhamento',
        startDate,
        endDate,
        contactId: 'contact-123',
        userId: 'user-456',
      })

      expect(appointment.title).toBe('Reunião de alinhamento')
      expect(appointment.status).toBe(AppointmentStatus.SCHEDULED)
      expect(appointment.reminderSent).toBe(false)
      expect(appointment.id).toBeDefined()
    })

    it('should emit AppointmentCreatedEvent on creation', () => {
      const appointment = Appointment.create({
        title: 'Test',
        startDate: makeFutureDate(60),
        endDate: makeFutureDate(120),
        contactId: 'c1',
        userId: 'u1',
      })

      const events = appointment.pullDomainEvents()

      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(AppointmentCreatedEvent)
    })

    it('should clear domain events after pulling them', () => {
      const appointment = Appointment.create({
        title: 'Test',
        startDate: makeFutureDate(60),
        endDate: makeFutureDate(120),
        contactId: 'c1',
        userId: 'u1',
      })

      appointment.pullDomainEvents()
      const secondPull = appointment.pullDomainEvents()

      expect(secondPull).toHaveLength(0)
    })
  })

  describe('cancel', () => {
    it('should cancel a scheduled appointment', () => {
      const appointment = Appointment.create({
        title: 'Test',
        startDate: makeFutureDate(60),
        endDate: makeFutureDate(120),
        contactId: 'c1',
        userId: 'u1',
      })
      appointment.pullDomainEvents()

      appointment.cancel()

      expect(appointment.status).toBe(AppointmentStatus.CANCELLED)
      const events = appointment.pullDomainEvents()
      expect(events[0].eventType).toBe('appointment.cancelled')
    })

    it('should throw when cancelling an already cancelled appointment', () => {
      const appointment = Appointment.create({
        title: 'Test',
        startDate: makeFutureDate(60),
        endDate: makeFutureDate(120),
        contactId: 'c1',
        userId: 'u1',
      })
      appointment.cancel()

      expect(() => appointment.cancel()).toThrow('already cancelled')
    })
  })

  describe('DateRange validation', () => {
    it('should throw when start date is after end date', () => {
      expect(() =>
        Appointment.create({
          title: 'Test',
          startDate: makeFutureDate(120),
          endDate: makeFutureDate(60),
          contactId: 'c1',
          userId: 'u1',
        }),
      ).toThrow('Start date must be before end date')
    })
  })
})
