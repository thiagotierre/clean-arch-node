import {
  PutCommand,
  GetCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import { Appointment } from '../../../domain/entities/Appointment'
import {
  IAppointmentRepository,
  ListAppointmentsFilter,
} from '../../../domain/repositories/IAppointmentRepository'
import { AppointmentMapper, AppointmentDynamoItem } from '../../../interfaces/mappers/AppointmentMapper'
import { getDynamoDBDocumentClient } from './DynamoDBClient'

const TABLE_NAME = process.env.DYNAMODB_TABLE_APPOINTMENTS ?? 'agenda-appointments-dev'

export class DynamoAppointmentRepository implements IAppointmentRepository {
  private get client() {
    return getDynamoDBDocumentClient()
  }

  async save(appointment: Appointment): Promise<void> {
    const item = AppointmentMapper.toDynamoItem(appointment)

    await this.client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      }),
    )
  }

  async findById(id: string): Promise<Appointment | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `APPOINTMENT#${id}`, SK: 'METADATA' },
      }),
    )

    if (!result.Item) return null

    return AppointmentMapper.fromDynamoItem(result.Item as AppointmentDynamoItem)
  }

  async findByUserId(filter: ListAppointmentsFilter): Promise<Appointment[]> {
    const keyCondition = filter.startDate && filter.endDate
      ? 'GSI1PK = :userId AND GSI1SK BETWEEN :start AND :end'
      : 'GSI1PK = :userId'

    const expressionValues: Record<string, unknown> = {
      ':userId': filter.userId,
    }

    if (filter.startDate) expressionValues[':start'] = filter.startDate.toISOString()
    if (filter.endDate) expressionValues[':end'] = filter.endDate.toISOString()

    let filterExpression: string | undefined
    if (filter.status) {
      filterExpression = '#status = :status'
      expressionValues[':status'] = filter.status
    }

    const result = await this.client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'userId-startDate-index',
        KeyConditionExpression: keyCondition,
        FilterExpression: filterExpression,
        ExpressionAttributeNames: filter.status ? { '#status': 'status' } : undefined,
        ExpressionAttributeValues: expressionValues,
      }),
    )

    return (result.Items ?? []).map((item) =>
      AppointmentMapper.fromDynamoItem(item as AppointmentDynamoItem),
    )
  }

  async findUpcomingWithoutReminder(from: Date, to: Date): Promise<Appointment[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'userId-startDate-index',
        KeyConditionExpression: 'GSI1SK BETWEEN :from AND :to',
        FilterExpression: '#status = :status AND reminderSent = :notSent',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':from': from.toISOString(),
          ':to': to.toISOString(),
          ':status': 'SCHEDULED',
          ':notSent': false,
        },
      }),
    )

    return (result.Items ?? []).map((item) =>
      AppointmentMapper.fromDynamoItem(item as AppointmentDynamoItem),
    )
  }

  async delete(id: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: `APPOINTMENT#${id}`, SK: 'METADATA' },
      }),
    )
  }
}
