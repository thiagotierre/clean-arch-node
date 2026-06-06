import {
  PutCommand,
  GetCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import { Contact } from '../../../domain/entities/Contact'
import { IContactRepository } from '../../../domain/repositories/IContactRepository'
import { ContactMapper, ContactDynamoItem } from '../../../interfaces/mappers/ContactMapper'
import { getDynamoDBDocumentClient } from './DynamoDBClient'

const TABLE_NAME = process.env.DYNAMODB_TABLE_CONTACTS ?? 'agenda-contacts-dev'

export class DynamoContactRepository implements IContactRepository {
  private get client() {
    return getDynamoDBDocumentClient()
  }

  async save(contact: Contact): Promise<void> {
    const item = ContactMapper.toDynamoItem(contact)

    await this.client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      }),
    )
  }

  async findById(id: string): Promise<Contact | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `CONTACT#${id}`, SK: 'METADATA' },
      }),
    )

    if (!result.Item) return null

    return ContactMapper.fromDynamoItem(result.Item as ContactDynamoItem)
  }

  async findByUserId(userId: string): Promise<Contact[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'CONTACT#',
        },
      }),
    )

    return (result.Items ?? []).map((item) =>
      ContactMapper.fromDynamoItem(item as ContactDynamoItem),
    )
  }

  async delete(id: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: `CONTACT#${id}`, SK: 'METADATA' },
      }),
    )
  }
}
