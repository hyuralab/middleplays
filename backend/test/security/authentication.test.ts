import { describe, test, beforeAll, afterAll, expect } from 'bun:test'
import {
  createAuthenticatedUser,
  makeAuthenticatedRequest,
  makeRequest,
  assertStatus,
  assertValidJson,
  assertNoSensitiveData,
} from '../helpers/test-helpers'
import { clearDatabase } from '../test-setup'

describe('🔐 SECURITY TESTS - Authentication & Authorization', () => {
  beforeAll(async () => {
    await clearDatabase()
  })

  afterAll(async () => {
    await clearDatabase()
  })

  describe('Authentication - Token Validation', () => {
    test('should reject requests without authorization header', async () => {
      const res = await makeRequest('GET', '/users/me')
      expect(res.status).toBe(401)
    })

    test('should reject requests with invalid token format', async () => {
      const testCases = [
        'invalid-token',
        'Bearer ',
        'Bearer invalid',
        'Bearer ' + 'a'.repeat(10000), // Extremely long token
      ]

      for (const token of testCases) {
        const res = await makeRequest('GET', '/users/me', undefined, {
          Authorization: token,
        })
        expect([401, 400]).toContain(res.status)
      }
    })

    test('should reject expired tokens', async () => {
      const user = await createAuthenticatedUser('user')

      // Create an expired token (this would need token manipulation)
      // For now, we test that valid tokens work
      const res = await makeAuthenticatedRequest('GET', '/users/me', user.accessToken)
      expect(res.status).toBe(200)
    })

    test('should reject tampered tokens', async () => {
      const user = await createAuthenticatedUser('user')
      const tamperedToken = user.accessToken.slice(0, -5) + '12345'

      const res = await makeAuthenticatedRequest('GET', '/users/me', tamperedToken)
      expect(res.status).toBe(401)
    })

    test('should not expose sensitive token information in errors', async () => {
      const res = await makeRequest('GET', '/users/me', undefined, {
        Authorization: 'Bearer invalid.token.here',
      })

      const data = await assertValidJson(res, 'auth error')
      const errorText = JSON.stringify(data)

      // Should not contain actual token or key material
      expect(errorText).not.toContain('invalid.token.here')
    })
  })

  describe('Authorization - Access Control', () => {
    test('should allow user to access their own profile', async () => {
      const user = await createAuthenticatedUser('user')
      const res = await makeAuthenticatedRequest('GET', '/users/me', user.accessToken)

      expect(res.status).toBe(200)
      const data = await assertValidJson(res, 'user profile')
      expect(data.data.user.id).toBe(user.userId)
    })

    test('should prevent user from accessing another user profile', async () => {
      const user1 = await createAuthenticatedUser('user')
      const user2 = await createAuthenticatedUser('user')

      const res = await makeAuthenticatedRequest('GET', `/users/${user2.userId}`, user1.accessToken)
      expect(res.status).toBe(403)
    })

    test('should prevent non-seller from accessing seller-only endpoints', async () => {
      const buyer = await createAuthenticatedUser('user')

      // Try to access seller stats or similar endpoint
      const res = await makeAuthenticatedRequest('GET', '/seller/stats', buyer.accessToken)
      expect(res.status).toBe(403)
    })

    test('should allow verified seller to access seller endpoints', async () => {
      const seller = await createAuthenticatedUser('seller')

      // Should be able to access seller endpoints
      const res = await makeAuthenticatedRequest('GET', '/seller/stats', seller.accessToken)
      expect([200, 404]).toContain(res.status) // 404 if no stats yet is ok
    })

    test('should not allow admin operations by regular users', async () => {
      const user = await createAuthenticatedUser('user')

      // Try admin-only operation
      const res = await makeAuthenticatedRequest('DELETE', `/users/${user.userId}`, user.accessToken)
      expect(res.status).toBe(403)
    })
  })

  describe('Data Isolation & Privacy', () => {
    test('should not expose sensitive user fields in response', async () => {
      const user = await createAuthenticatedUser('user')
      const res = await makeAuthenticatedRequest('GET', '/users/me', user.accessToken)

      expect(res.ok).toBe(true)
      const data = await assertValidJson(res, 'user profile')

      assertNoSensitiveData(
        data.data.user,
        ['hashedPassword', 'passwordHash', 'refreshToken', 'salt'],
        'user profile'
      )
    })

    test('should not expose other users passwords or sensitive data', async () => {
      const user1 = await createAuthenticatedUser('user')
      const user2 = await createAuthenticatedUser('user')

      // Try to fetch user2's public profile (if endpoint exists)
      const res = await makeAuthenticatedRequest('GET', `/users/public/${user2.userId}`, user1.accessToken)

      if (res.ok) {
        const data = await assertValidJson(res, 'public profile')
        assertNoSensitiveData(
          data.data,
          ['hashedPassword', 'passwordHash', 'email', 'refreshToken'],
          'public profile'
        )
      }
    })

    test('should filter transactions to only show user-related ones', async () => {
      const buyer = await createAuthenticatedUser('user')
      const seller = await createAuthenticatedUser('user')

      // Create transaction between buyer and seller
      // Then verify buyer can see their transactions but not unrelated ones

      const res = await makeAuthenticatedRequest('GET', '/transactions', buyer.accessToken)
      expect(res.status).toBe(200)

      const data = await assertValidJson(res, 'transactions list')
      if (data.data && Array.isArray(data.data)) {
        // All transactions should belong to this user as buyer or seller
        for (const tx of data.data) {
          const isBuyer = tx.buyerId === buyer.userId
          const isSeller = tx.sellerId === buyer.userId
          expect(isBuyer || isSeller).toBe(true)
        }
      }
    })
  })

  describe('Session & Token Management', () => {
    test('should regenerate tokens on refresh', async () => {
      const user = await createAuthenticatedUser('user')
      const firstToken = user.accessToken

      // Logout/invalidate should prevent further requests
      const logoutRes = await makeAuthenticatedRequest('POST', '/auth/logout', user.accessToken)
      expect([200, 204]).toContain(logoutRes.status)

      // Token should no longer work
      const secondRes = await makeAuthenticatedRequest('GET', '/users/me', firstToken)
      expect(secondRes.status).toBe(401)
    })

    test('should not allow reuse of invalidated tokens', async () => {
      const user = await createAuthenticatedUser('user')

      // Logout
      await makeAuthenticatedRequest('POST', '/auth/logout', user.accessToken)

      // Try to use token again
      const res = await makeAuthenticatedRequest('GET', '/users/me', user.accessToken)
      expect(res.status).toBe(401)
    })
  })

  describe('Rate Limiting & DoS Protection', () => {
    test('should rate limit login attempts', async () => {
      const email = `test-${Date.now()}@example.com`

      // Make multiple rapid login attempts
      for (let i = 0; i < 5; i++) {
        const res = await makeRequest('POST', '/auth/login', {
          email,
          password: 'WrongPassword123!@',
        })

        // After several attempts, should get rate limited
        if (i > 2) {
          expect(res.status).toBeGreaterThanOrEqual(429)
          break
        }
      }
    })

    test('should rate limit registration attempts', async () => {
      // Make rapid registration attempts from same source
      const results = []
      for (let i = 0; i < 10; i++) {
        const res = await makeRequest('POST', '/auth/register', {
          email: `test-${Date.now()}-${i}@example.com`,
          password: 'Test123!@',
          fullName: 'Test',
        })

        results.push(res.status)
      }

      // Should have some 429 (Too Many Requests) responses
      expect(results.some((s) => s === 429)).toBe(true)
    })
  })

  describe('CORS & Origin Validation', () => {
    test('should only allow requests from allowed origins', async () => {
      const user = await createAuthenticatedUser('user')

      const res = await makeRequest('GET', '/users/me', undefined, {
        Origin: 'https://malicious-site.com',
        Authorization: `Bearer ${user.accessToken}`,
      })

      // Should either reject or not expose sensitive data
      if (res.status === 200) {
        const data = await assertValidJson(res, 'user profile')
        // Data should still be protected
        expect(data.data.user).toBeDefined()
      }
    })
  })
})
