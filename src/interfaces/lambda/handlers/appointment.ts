import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { z } from 'zod'
import { getContainer } from '../../../infrastructure/container/DIContainer'
import { httpResponse, httpError } from '../utils/http'

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  contactId: z.string().uuid(),
})

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export async function create(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub ?? 'user-local'
    const body = JSON.parse(event.body ?? '{}')
    const dto = createSchema.parse(body)

    const container = getContainer()
    const result = await container.createAppointment.execute({ ...dto, userId })

    return httpResponse(201, result)
  } catch (error) {
    return httpError(error)
  }
}

export async function list(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub ?? 'user-local'
    const { startDate, endDate, status } = event.queryStringParameters ?? {}

    const container = getContainer()
    const result = await container.listAppointments.execute({ userId, startDate, endDate, status })

    return httpResponse(200, result)
  } catch (error) {
    return httpError(error)
  }
}

export async function getById(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub ?? 'user-local'
    const { id } = event.pathParameters ?? {}

    if (!id) return httpResponse(400, { message: 'Missing appointment id' })

    const container = getContainer()
    const result = await container.getAppointment.execute(id, userId)

    return httpResponse(200, result)
  } catch (error) {
    return httpError(error)
  }
}

export async function update(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub ?? 'user-local'
    const { id } = event.pathParameters ?? {}

    if (!id) return httpResponse(400, { message: 'Missing appointment id' })

    const body = JSON.parse(event.body ?? '{}')
    const dto = updateSchema.parse(body)

    const container = getContainer()
    const result = await container.updateAppointment.execute({ ...dto, id, userId })

    return httpResponse(200, result)
  } catch (error) {
    return httpError(error)
  }
}

export async function cancel(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub ?? 'user-local'
    const { id } = event.pathParameters ?? {}

    if (!id) return httpResponse(400, { message: 'Missing appointment id' })

    const container = getContainer()
    const result = await container.cancelAppointment.execute(id, userId)

    return httpResponse(200, result)
  } catch (error) {
    return httpError(error)
  }
}
