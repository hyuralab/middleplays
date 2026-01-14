import { describe, test, beforeAll, afterAll, expect } from 'bun:test'
import { getApp } from '../test-setup'
import { clearDatabase, clearRateLimits } from '../test-setup'
import {
  createAuthenticatedUser,
  makeRequest,
  assertStatus,
  assertValidJson,
  assertNoSensitiveData,
} from '../helpers/test-helpers'
import { securityTestPayloads } from '../fixtures/users.fixtures'
import { db } from '../../src/db'

describe('🔐 SECURITY TESTS - Input Validation & SQL Injection Prevention', () => {
  beforeAll(async () => {
    await clearDatabase()
  })

  afterAll(async () => {
    await clearDatabase()
  })

  describe('SQL Injection Prevention', () => {
    test('should prevent SQL injection in registration email', async () => {
      for (const payload of securityTestPayloads.sqlInjection) {
        const res = await makeRequest('POST', '/auth/register', {
          email: payload,
          password: 'TestPass123!@',
          fullName: 'Test',
        })

        // SQL injection payloads should be rejected
        // (they don't have valid email format anyway)
        expect([400, 422, 409]).toContain(res.status)
      }
    })

    test('should prevent SQL injection in user fullName', async () => {
      for (const payload of securityTestPayloads.sqlInjection) {
        const res = await makeRequest('POST', '/auth/register', {
          email: `test-${Date.now()}-sqli@example.com`,
          password: 'TestPass123!@',
          fullName: payload,
        })

        // If registration succeeds, verify payload wasn't executed
        if (res.ok) {
          const data = await assertValidJson(res, 'registration')
          const userId = data.data?.user?.id
          if (userId) {
            // Verify no malicious code was executed
            const profiles = await db`SELECT full_name FROM user_profiles WHERE user_id = ${userId}`
            if (profiles && profiles.length > 0) {
              const profile = profiles[0] as { full_name?: string }
              if (profile.full_name) {
                expect(profile.full_name).not.toContain('DROP')
              }
            }
          }
        }
      }
    })

    test('should safely handle quotes in user input', async () => {
      const testCases = [
        "O'Brien",
        'Test "quoted" name',
        "Test's name with apostrophe",
      ]

      for (const name of testCases) {
        const res = await makeRequest('POST', '/auth/register', {
          email: `test-${Date.now()}@example.com`,
          password: 'TestPass123!@',
          fullName: name,
        })

        if (res.ok) {
          const data = await assertValidJson(res, 'registration')
          expect(data.data.user.fullName).toBe(name)
        }
      }
    })
  })

  describe('XSS Prevention', () => {
    test('should prevent XSS in email field', async () => {
      for (const payload of securityTestPayloads.xss) {
        const res = await makeRequest('POST', '/auth/register', {
          email: payload,
          password: 'TestPass123!@',
          fullName: 'Test',
        })

        // XSS payloads in email should be rejected (invalid email format)
        expect([400, 422]).toContain(res.status)
      }
    })

    test('should sanitize XSS in fullName and never return unescaped HTML', async () => {
      for (const payload of securityTestPayloads.xss) {
        const res = await makeRequest('POST', '/auth/register', {
          email: `test-${Date.now()}@example.com`,
          password: 'TestPass123!@',
          fullName: payload,
        })

        if (res.ok) {
          const data = await assertValidJson(res, 'registration')
          const returnedName = data.data.user.fullName

          // Check that script tags are not in the response
          expect(returnedName).not.toContain('<script>')
          expect(returnedName).not.toContain('onerror=')
          expect(returnedName).not.toContain('onload=')
          expect(returnedName).not.toContain('javascript:')
        }
      }
    })

    test('should not return sensitive data in error messages', async () => {
      const res = await makeRequest('POST', '/auth/register', {
        email: 'invalid-email',
        password: 'pass',
        fullName: 'Test',
      })

      const data = await assertValidJson(res, 'validation error')
      assertNoSensitiveData(data, ['password', 'hashedPassword', 'email'], 'error response')
    })
  })

  describe('Type Validation & Boundary Testing', () => {
    test('should reject empty strings for required fields', async () => {
      const testCases = [
        { email: '', password: 'Test123!@', fullName: 'Test', field: 'email' },
        { email: 'test@test.com', password: '', fullName: 'Test', field: 'password' },
        { email: 'test@test.com', password: 'Test123!@', fullName: '', field: 'fullName' },
      ]

      for (const testCase of testCases) {
        const { field, ...data } = testCase
        const res = await makeRequest('POST', '/auth/register', data)
        expect([400, 422]).toContain(res.status)
      }
    })

    test('should reject fields with wrong type', async () => {
      const testCases = [
        { email: 123, password: 'Test123!@', fullName: 'Test' },
        { email: 'test@test.com', password: 456, fullName: 'Test' },
        { email: 'test@test.com', password: 'Test123!@', fullName: {} },
      ]

      for (const data of testCases) {
        const res = await makeRequest('POST', '/auth/register', data)
        expect([400, 422]).toContain(res.status)
      }
    })

    test('should enforce maximum field lengths', async () => {
      const testCases = [
        {
          email: `${'a'.repeat(500)}@example.com`,
          password: 'Test123!@',
          fullName: 'Test',
        },
        { email: 'test@test.com', password: 'a'.repeat(5000), fullName: 'Test' },
        {
          email: 'test@test.com',
          password: 'Test123!@',
          fullName: 'a'.repeat(5000),
        },
      ]

      for (const data of testCases) {
        const res = await makeRequest('POST', '/auth/register', data)
        expect([400, 422]).toContain(res.status)
      }
    })
  })

  describe('Email Validation', () => {
    test('should reject invalid email formats', async () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user space@example.com',
        'user@@example.com',
      ]

      for (const email of invalidEmails) {
        const res = await makeRequest('POST', '/auth/register', {
          email,
          password: 'Test123!@',
          fullName: 'Test',
        })

        expect([400, 422]).toContain(res.status)
      }
    })

    test('should accept valid email formats', async () => {
      const validEmails = [
        'user@example.com',
        'user+tag@example.co.uk',
        'user.name@example.com',
        'user_name@example.com',
      ]

      for (const email of validEmails) {
        const res = await makeRequest('POST', '/auth/register', {
          email,
          password: 'Test123!@',
          fullName: 'Test',
        })

        // Should be OK or conflict (if test runs multiple times)
        expect([200, 201, 409]).toContain(res.status)
      }
    })
  })

  describe('Password Security', () => {
    test('should enforce minimum password length', async () => {
      const weakPasswords = ['1', '12', '123', 'short']

      for (const password of weakPasswords) {
        const res = await makeRequest('POST', '/auth/register', {
          email: `test-${Date.now()}@example.com`,
          password,
          fullName: 'Test',
        })

        expect([400, 422]).toContain(res.status)
      }
    })

    test('should never return password in response', async () => {
      const res = await makeRequest('POST', '/auth/register', {
        email: `test-${Date.now()}@example.com`,
        password: 'TestPass123!@',
        fullName: 'Test User',
      })

      if (res.ok) {
        const data = await assertValidJson(res, 'registration')
        assertNoSensitiveData(
          data,
          ['password', 'hashedPassword', 'passwordHash'],
          'registration response'
        )
      }
    })

    test('should not log passwords in error messages', async () => {
      // This is more of a logging check - ensure error doesn't expose password
      const res = await makeRequest('POST', '/auth/login', {
        email: 'nonexistent@example.com',
        password: 'TestPass123!@',
      })

      const data = await assertValidJson(res, 'login error')
      const errorText = JSON.stringify(data)
      expect(errorText).not.toContain('TestPass123!@')
    })
  })

  describe('Null Byte & Special Character Injection', () => {
    test('should handle null bytes safely', async () => {
      const testCases = [
        'test\x00.com@example.com',
        'test@example\x00.com',
        "test'@example.com",
      ]

      for (const email of testCases) {
        const res = await makeRequest('POST', '/auth/register', {
          email,
          password: 'Test123!@',
          fullName: 'Test',
        })

        // Should reject or sanitize safely
        expect(res.status).toBeGreaterThanOrEqual(400)
      }
    })
  })
})
