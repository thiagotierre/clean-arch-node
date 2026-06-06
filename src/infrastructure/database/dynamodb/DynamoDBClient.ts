import {
  DynamoDBClient as AWSDynamoDBClient,
  DynamoDBClientConfig,
} from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

let documentClient: DynamoDBDocumentClient | null = null

export function getDynamoDBDocumentClient(): DynamoDBDocumentClient {
  if (documentClient) return documentClient

  const config: DynamoDBClientConfig = {
    region: process.env.AWS_REGION ?? 'us-east-1',
  }

  if (process.env.DYNAMODB_ENDPOINT) {
    config.endpoint = process.env.DYNAMODB_ENDPOINT
    config.credentials = {
      accessKeyId: 'local',
      secretAccessKey: 'local',
    }
  }

  const client = new AWSDynamoDBClient(config)
  documentClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  })

  return documentClient
}
