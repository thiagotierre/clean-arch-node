import {
  DynamoDBClient,
  CreateTableCommand,
  ListTablesCommand,
} from '@aws-sdk/client-dynamodb'

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})

async function tableExists(tableName: string): Promise<boolean> {
  const result = await client.send(new ListTablesCommand({}))
  return result.TableNames?.includes(tableName) ?? false
}

async function createAppointmentsTable(): Promise<void> {
  const tableName = process.env.DYNAMODB_TABLE_APPOINTMENTS ?? 'agenda-appointments-dev'

  if (await tableExists(tableName)) {
    console.log(`Table ${tableName} already exists, skipping.`)
    return
  }

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
        { AttributeName: 'GSI1PK', AttributeType: 'S' },
        { AttributeName: 'GSI1SK', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'userId-startDate-index',
          KeySchema: [
            { AttributeName: 'GSI1PK', KeyType: 'HASH' },
            { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    }),
  )

  console.log(`Table ${tableName} created successfully.`)
}

async function createContactsTable(): Promise<void> {
  const tableName = process.env.DYNAMODB_TABLE_CONTACTS ?? 'agenda-contacts-dev'

  if (await tableExists(tableName)) {
    console.log(`Table ${tableName} already exists, skipping.`)
    return
  }

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
    }),
  )

  console.log(`Table ${tableName} created successfully.`)
}

async function main(): Promise<void> {
  console.log('Setting up DynamoDB tables...')
  await createAppointmentsTable()
  await createContactsTable()
  console.log('Setup complete.')
}

main().catch((error) => {
  console.error('Setup failed:', error)
  process.exit(1)
})
