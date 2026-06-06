import { DynamoAppointmentRepository } from '../database/dynamodb/DynamoAppointmentRepository'
import { DynamoContactRepository } from '../database/dynamodb/DynamoContactRepository'
import { RabbitMQPublisher } from '../messaging/rabbitmq/RabbitMQPublisher'
import { CreateAppointmentUseCase } from '../../application/use-cases/appointment/CreateAppointment'
import { GetAppointmentUseCase } from '../../application/use-cases/appointment/GetAppointment'
import { ListAppointmentsUseCase } from '../../application/use-cases/appointment/ListAppointments'
import { UpdateAppointmentUseCase } from '../../application/use-cases/appointment/UpdateAppointment'
import { CancelAppointmentUseCase } from '../../application/use-cases/appointment/CancelAppointment'
import { SendRemindersUseCase } from '../../application/use-cases/appointment/SendReminders'
import { CreateContactUseCase } from '../../application/use-cases/contact/CreateContact'
import { GetContactUseCase } from '../../application/use-cases/contact/GetContact'
import { ListContactsUseCase } from '../../application/use-cases/contact/ListContacts'

function buildContainer() {
  const appointmentRepository = new DynamoAppointmentRepository()
  const contactRepository = new DynamoContactRepository()
  const messagePublisher = new RabbitMQPublisher()

  return {
    createAppointment: new CreateAppointmentUseCase(appointmentRepository, messagePublisher),
    getAppointment: new GetAppointmentUseCase(appointmentRepository),
    listAppointments: new ListAppointmentsUseCase(appointmentRepository),
    updateAppointment: new UpdateAppointmentUseCase(appointmentRepository),
    cancelAppointment: new CancelAppointmentUseCase(appointmentRepository, messagePublisher),
    sendReminders: new SendRemindersUseCase(appointmentRepository, messagePublisher),
    createContact: new CreateContactUseCase(contactRepository),
    getContact: new GetContactUseCase(contactRepository),
    listContacts: new ListContactsUseCase(contactRepository),
  }
}

let container: ReturnType<typeof buildContainer> | null = null

export function getContainer() {
  if (!container) {
    container = buildContainer()
  }
  return container
}
