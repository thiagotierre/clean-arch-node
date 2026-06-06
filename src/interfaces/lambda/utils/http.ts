import { APIGatewayProxyResult } from 'aws-lambda'
import { ZodError } from 'zod'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json',
}

export function httpResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  }
}

export function httpError(error: unknown): APIGatewayProxyResult {
  if (error instanceof ZodError) {
    return httpResponse(400, {
      message: 'Validation error',
      errors: error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    })
  }

  if (error instanceof Error) {
    if (error.message.includes('not found')) {
      return httpResponse(404, { message: error.message })
    }
    if (error.message.includes('already cancelled') || error.message.includes('Cannot')) {
      return httpResponse(422, { message: error.message })
    }
    if (error.message.includes('past') || error.message.includes('before end date')) {
      return httpResponse(400, { message: error.message })
    }
  }

  console.error(JSON.stringify({ message: 'Unhandled error', error: String(error) }))
  return httpResponse(500, { message: 'Internal server error' })
}
