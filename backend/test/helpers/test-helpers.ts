import { getApp } from '../test-setup'
import { db } from '../../src/db'
import { createId } from '@paralleldrive/cuid2'

/**
 * Test context that handles setup/cleanup for each test
 */
export class TestContext {
  private app: any

  async setup() {
    this.app = getApp()
  }

  async cleanup() {
    // Cleanup will be handled by test suite
  }

  getApp() {
    return this.app
  }
}

/**
 * Create and authenticate a test user
 */
export async function createAuthenticatedUser(
  role: 'user' | 'seller' | 'admin' = 'user',
  overrides = {}
) {
  const app = getApp()
  const email = `test-${createId()}@example.com`
  const password = 'TestSecure123!@'

  // Register
  const registerRes = await app.handle(
    new Request('http://localhost/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName: 'Test User', ...overrides }),
    })
  )

  if (!registerRes.ok) {
    throw new Error(`Registration failed: ${registerRes.status}`)
  }

  const { data } = await registerRes.json()
  const userId = data.user.id

  // Update role if needed
  if (role !== 'user') {
    await db`UPDATE users SET role = ${role}, is_verified = true WHERE id = ${userId}`
  }

  // Login
  const loginRes = await app.handle(
    new Request('http://localhost/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  )

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status}`)
  }

  const loginData = await loginRes.json()

  return {
    userId,
    email,
    password,
    role,
    accessToken: loginData.data.accessToken,
    refreshToken: loginData.data.refreshToken,
  }
}

/**
 * Make authenticated request
 */
export async function makeAuthenticatedRequest(
  method: string,
  path: string,
  accessToken: string,
  body?: any
) {
  const app = getApp()
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  return app.handle(new Request(`http://localhost${path}`, options))
}

/**
 * Make unauthenticated request
 */
export async function makeRequest(
  method: string,
  path: string,
  body?: any,
  headers?: Record<string, string>
) {
  const app = getApp()
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  return app.handle(new Request(`http://localhost${path}`, options))
}

/**
 * Assert response status
 */
export function assertStatus(response: Response, expectedStatus: number, context: string) {
  if (response.status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus} but got ${response.status} for ${context}`)
  }
}

/**
 * Assert response is valid JSON
 */
export async function assertValidJson(response: Response, context: string) {
  try {
    const text = await response.text()
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`Expected valid JSON response for ${context}, got parsing error: ${error}`)
  }
}

/**
 * Assert field exists in response
 */
export function assertField(obj: any, field: string, context: string) {
  if (!(field in obj)) {
    throw new Error(`Expected field '${field}' in response for ${context}`)
  }
}

/**
 * Assert field type
 */
export function assertFieldType(
  obj: any,
  field: string,
  expectedType: string,
  context: string
) {
  if (typeof obj[field] !== expectedType) {
    throw new Error(
      `Expected field '${field}' to be ${expectedType} for ${context}, got ${typeof obj[field]}`
    )
  }
}

/**
 * Assert all required fields exist
 */
export function assertRequiredFields(obj: any, fields: string[], context: string) {
  for (const field of fields) {
    assertField(obj, field, `${context} - field: ${field}`)
  }
}

/**
 * Assert no sensitive data in response
 */
export function assertNoSensitiveData(obj: any, sensitiveFields: string[], context: string) {
  const sensitiveFieldsInResponse = sensitiveFields.filter((field) => field in obj)
  if (sensitiveFieldsInResponse.length > 0) {
    throw new Error(
      `Found sensitive fields in response for ${context}: ${sensitiveFieldsInResponse.join(', ')}`
    )
  }
}

/**
 * Create a test game
 */
export async function createTestGame(owner: string) {
  const game = await db`
    INSERT INTO games (name, description, developer, release_date)
    VALUES ('Test Game ' || ${createId()}, 'Test Description', 'Test Dev', NOW())
    RETURNING *
  `
  return game[0]
}

/**
 * Create a test posting
 */
export async function createTestPosting(
  gameId: string,
  userId: string,
  overrides = {}
) {
  const posting = await db`
    INSERT INTO game_accounts (
      game_id, seller_id, username, password, server_region, level, price, description, status
    )
    VALUES (
      ${gameId},
      ${userId},
      'testaccount_' || ${createId()},
      'encrypted_pass_' || ${createId()},
      'US-East',
      50,
      100000,
      'Test Account',
      'active'
    )
    RETURNING *
  `
  return posting[0]
}

/**
 * Create a test transaction
 */
export async function createTestTransaction(
  postingId: string,
  buyerId: string,
  sellerId: string,
  overrides = {}
) {
  const transaction = await db`
    INSERT INTO transactions (
      posting_id, buyer_id, seller_id, amount, status, payment_method, xendit_invoice_id
    )
    VALUES (
      ${postingId},
      ${buyerId},
      ${sellerId},
      100000,
      'pending',
      'card',
      'test-invoice-' || ${createId()}
    )
    RETURNING *
  `
  return transaction[0]
}
