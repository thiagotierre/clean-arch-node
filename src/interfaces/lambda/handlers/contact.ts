import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { z } from 'zod'
import { getContainer } from '../../../infrastructure/container/DIContainer'
import { httpResponse, httpError } from '../utils/http'

const createSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().optional(),
})

export async function create(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub ?? 'user-local'
    const body = JSON.parse(event.body ?? '{}')
    const dto = createSchema.parse(body)

    const container = getContainer()
    const result = await container.createContact.execute({ ...dto, userId })

    return httpResponse(201, result)
  } catch (error) {
    return httpError(error)
  }
}

export async function list(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub ?? 'user-local'

    const container = getContainer()
    const result = await container.listContacts.execute(userId)

    return httpResponse(200, result)
  } catch (error) {
    return httpError(error)
  }
}

export async function getById(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub ?? 'user-local'
    const { id } = event.pathParameters ?? {}

    if (!id) return httpResponse(400, { message: 'Missing contact id' })

    const container = getContainer()
    const result = await container.getContact.execute(id, userId)

    return httpResponse(200, result)
  } catch (error) {
    return httpError(error)
  }
}
