import { describe, test, beforeAll, afterAll, expect } from 'bun:test'
import {
  createAuthenticatedUser,
  makeAuthenticatedRequest,
  makeRequest,
  createTestGame,
  createTestPosting,
  assertValidJson,
  assertRequiredFields,
  assertNoSensitiveData,
} from '../helpers/test-helpers'
import { clearDatabase } from '../test-setup'
import { db } from '../../src/db'

describe('🎮 BUSINESS LOGIC TESTS - Users Module', () => {
  beforeAll(async () => {
    await clearDatabase()
  })

  afterAll(async () => {
    await clearDatabase()
  })

  describe('User Registration', () => {
    test('should successfully register a new user', async () => {
      const res = await makeRequest('POST', '/auth/register', {
        email: `test-${Date.now()}@example.com`,
        password: 'SecurePass123!@',
        fullName: 'Test User',
      })

      expect(res.status).toBe(201)
      const data = await assertValidJson(res, 'registration')

      assertRequiredFields(data.data.user, ['id', 'email', 'fullName'], 'user object')
      expect(data.data.user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    })

    test('should prevent duplicate email registration', async () => {
      const email = `duplicate-${Date.now()}@example.com`

      // First registration
      const res1 = await makeRequest('POST', '/auth/register', {
        email,
        password: 'SecurePass123!@',
        fullName: 'Test User 1',
      })
      expect(res1.status).toBe(201)

      // Duplicate registration
      const res2 = await makeRequest('POST', '/auth/register', {
        email,
        password: 'SecurePass123!@',
        fullName: 'Test User 2',
      })
      expect(res2.status).toBe(409) // Conflict
    })

    test('should hash password before storing', async () => {
      const password = 'PlainTextPass123!@'
      const res = await makeRequest('POST', '/auth/register', {
        email: `test-${Date.now()}@example.com`,
        password,
        fullName: 'Test User',
      })

      expect(res.ok).toBe(true)

      // Verify password is not stored in plain text
      const dbUsers = await db`SELECT password FROM users LIMIT 1`
      if (dbUsers && dbUsers.length > 0) {
        const user = dbUsers[0] as { password?: string }
        if (user.password) {
          expect(user.password).not.toBe(password)
          expect(user.password).not.toContain(password)
        }
      }
    })
  })

  describe('User Login', () => {
    test('should successfully login with correct credentials', async () => {
      const email = `login-test-${Date.now()}@example.com`
      const password = 'LoginPass123!@'

      // Register first
      await makeRequest('POST', '/auth/register', {
        email,
        password,
        fullName: 'Login Test',
      })

      // Login
      const res = await makeRequest('POST', '/auth/login', {
        email,
        password,
      })

      expect(res.status).toBe(200)
      const data = await assertValidJson(res, 'login')

      assertRequiredFields(data.data, ['accessToken', 'refreshToken', 'user'], 'login response')
      expect(data.data.user.email).toBe(email)
    })

    test('should reject login with wrong password', async () => {
      const email = `wrong-pass-${Date.now()}@example.com`

      // Register
      await makeRequest('POST', '/auth/register', {
        email,
        password: 'CorrectPass123!@',
        fullName: 'Wrong Pass Test',
      })

      // Try wrong password
      const res = await makeRequest('POST', '/auth/login', {
        email,
        password: 'WrongPass123!@',
      })

      expect(res.status).toBe(401)
    })

    test('should reject login for non-existent user', async () => {
      const res = await makeRequest('POST', '/auth/login', {
        email: 'nonexistent@example.com',
        password: 'SomePass123!@',
      })

      expect(res.status).toBe(401)
    })

    test('should not return password in login response', async () => {
      const user = await createAuthenticatedUser('user')

      assertNoSensitiveData(user, ['password'], 'login response')
    })
  })

  describe('User Profile', () => {
    test('should retrieve user profile', async () => {
      const user = await createAuthenticatedUser('user')
      const res = await makeAuthenticatedRequest('GET', '/users/me', user.accessToken)

      expect(res.status).toBe(200)
      const data = await assertValidJson(res, 'user profile')

      assertRequiredFields(data.data.user, ['id', 'email', 'fullName', 'role'], 'user profile')
      expect(data.data.user.id).toBe(user.userId)
    })

    test('should update user profile', async () => {
      const user = await createAuthenticatedUser('user')
      const newName = 'Updated Name ' + Date.now()

      const res = await makeAuthenticatedRequest('PUT', '/users/me', user.accessToken, {
        fullName: newName,
      })

      expect([200, 204]).toContain(res.status)

      // Verify update
      const verifyRes = await makeAuthenticatedRequest('GET', '/users/me', user.accessToken)
      const data = await assertValidJson(verifyRes, 'updated profile')
      expect(data.data.user.fullName).toBe(newName)
    })

    test('should prevent profile update with invalid data', async () => {
      const user = await createAuthenticatedUser('user')

      const res = await makeAuthenticatedRequest('PUT', '/users/me', user.accessToken, {
        fullName: '', // Empty name
      })

      expect([400, 422]).toContain(res.status)
    })

    test('should not allow changing email in profile update', async () => {
      const user = await createAuthenticatedUser('user')

      const res = await makeAuthenticatedRequest('PUT', '/users/me', user.accessToken, {
        email: 'newemail@example.com',
      })

      // Should either reject or not update
      const verifyRes = await makeAuthenticatedRequest('GET', '/users/me', user.accessToken)
      const data = await assertValidJson(verifyRes, 'user profile')
      expect(data.data.user.email).toBe(user.email)
    })
  })

  describe('User Deletion & Data Privacy', () => {
    test('should not allow user self-deletion without confirmation', async () => {
      const user = await createAuthenticatedUser('user')

      const res = await makeAuthenticatedRequest('DELETE', '/users/me', user.accessToken)

      // Should require confirmation or not allow
      expect([400, 403]).toContain(res.status)
    })

    test('should delete all user-related data on account deletion', async () => {
      const user = await createAuthenticatedUser('user')

      // TODO: Implement proper delete with confirmation
      // Then verify all related data is deleted
    })
  })

  describe('Role Management', () => {
    test('should not allow user to change their own role', async () => {
      const user = await createAuthenticatedUser('user')

      const res = await makeAuthenticatedRequest('PUT', '/users/me', user.accessToken, {
        role: 'seller',
      })

      expect([400, 403]).toContain(res.status)

      // Verify role didn't change
      const verifyRes = await makeAuthenticatedRequest('GET', '/users/me', user.accessToken)
      const data = await assertValidJson(verifyRes, 'user profile')
      expect(data.data.user.role).toBe('user')
    })

    test('should mark user as verified seller only through proper KYC flow', async () => {
      const user = await createAuthenticatedUser('user')
      expect(user.role).toBe('user')

      // User should not be able to directly change to verified_seller
      const res = await makeAuthenticatedRequest('PUT', '/users/me', user.accessToken, {
        isVerified: true,
      })

      const verifyRes = await makeAuthenticatedRequest('GET', '/users/me', user.accessToken)
      const data = await assertValidJson(verifyRes, 'user profile')
      expect(data.data.user.isVerified).not.toBe(true)
    })
  })
})
