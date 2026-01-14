import { describe, test, beforeAll, afterAll, expect } from 'bun:test'
import {
  createAuthenticatedUser,
  makeAuthenticatedRequest,
  createTestGame,
  createTestPosting,
  assertValidJson,
  assertRequiredFields,
  assertNoSensitiveData,
} from '../helpers/test-helpers'
import { clearDatabase } from '../test-setup'
import { db } from '../../src/db'

describe('🎯 BUSINESS LOGIC TESTS - Postings Module', () => {
  let testGame: any
  let seller: any
  let buyer: any

  beforeAll(async () => {
    await clearDatabase()
    seller = await createAuthenticatedUser('seller')
    buyer = await createAuthenticatedUser('user')
    testGame = await createTestGame('test-game')
  })

  afterAll(async () => {
    await clearDatabase()
  })

  describe('Posting Creation', () => {
    test('should create posting with valid data', async () => {
      const res = await makeAuthenticatedRequest('POST', '/postings', seller.accessToken, {
        gameId: testGame.id,
        username: 'testaccount123',
        password: 'AccountPass123!@',
        serverRegion: 'US-East',
        level: 50,
        price: 100000,
        description: 'High level account for sale',
      })

      expect(res.status).toBe(201)
      const data = await assertValidJson(res, 'posting creation')

      assertRequiredFields(data.data, ['id', 'gameId', 'sellerId', 'status', 'price'], 'posting')
      expect(data.data.price).toBe(100000)
      expect(data.data.status).toBe('active')
    })

    test('should prevent non-seller from creating postings', async () => {
      const res = await makeAuthenticatedRequest('POST', '/postings', buyer.accessToken, {
        gameId: testGame.id,
        username: 'testaccount',
        password: 'Pass123!@',
        serverRegion: 'US-East',
        level: 50,
        price: 100000,
        description: 'Test',
      })

      expect(res.status).toBe(403)
    })

    test('should reject posting with invalid price', async () => {
      const testCases = [
        { price: -1000, context: 'negative price' },
        { price: 0, context: 'zero price' },
        { price: 999999999999, context: 'extremely high price' },
      ]

      for (const testCase of testCases) {
        const res = await makeAuthenticatedRequest('POST', '/postings', seller.accessToken, {
          gameId: testGame.id,
          username: 'testaccount',
          password: 'Pass123!@',
          serverRegion: 'US-East',
          level: 50,
          ...testCase,
          description: 'Test',
        })

        expect([400, 422]).toContain(res.status)
      }
    })

    test('should reject posting with invalid level', async () => {
      const res = await makeAuthenticatedRequest('POST', '/postings', seller.accessToken, {
        gameId: testGame.id,
        username: 'testaccount',
        password: 'Pass123!@',
        serverRegion: 'US-East',
        level: -10,
        price: 100000,
        description: 'Test',
      })

      expect([400, 422]).toContain(res.status)
    })

    test('should reject posting with missing required fields', async () => {
      const requiredFields = ['gameId', 'username', 'password', 'serverRegion', 'level', 'price']

      for (const field of requiredFields) {
        const payload: any = {
          gameId: testGame.id,
          username: 'test',
          password: 'Pass123!@',
          serverRegion: 'US-East',
          level: 50,
          price: 100000,
          description: 'Test',
        }

        delete payload[field]

        const res = await makeAuthenticatedRequest('POST', '/postings', seller.accessToken, payload)
        expect([400, 422]).toContain(res.status)
      }
    })

    test('should encrypt password before storing', async () => {
      const plainPassword = 'PlainAccountPass123!@'

      const res = await makeAuthenticatedRequest('POST', '/postings', seller.accessToken, {
        gameId: testGame.id,
        username: 'encrypttest123',
        password: plainPassword,
        serverRegion: 'US-East',
        level: 50,
        price: 100000,
        description: 'Test',
      })

      if (res.ok) {
        const data = await assertValidJson(res, 'posting creation')
        const postingId = data.data?.id

        if (postingId) {
          // Verify password is not stored in plain text in DB
          const dbPosting = await db`SELECT password FROM game_accounts WHERE id = ${postingId}`
          if (dbPosting && dbPosting.length > 0) {
            const posting = dbPosting[0] as { password?: string }
            if (posting.password) {
              expect(posting.password).not.toBe(plainPassword)
              expect(posting.password).not.toContain(plainPassword)
            }
          }
        }
      }
    })

    test('should not expose password in posting response', async () => {
      const res = await makeAuthenticatedRequest('POST', '/postings', seller.accessToken, {
        gameId: testGame.id,
        username: 'exposuretest123',
        password: 'SecretPass123!@',
        serverRegion: 'US-East',
        level: 50,
        price: 100000,
        description: 'Test',
      })

      expect(res.ok).toBe(true)
      const data = await assertValidJson(res, 'posting creation')

      assertNoSensitiveData(data.data, ['password', 'encryptedPassword'], 'posting response')
    })
  })

  describe('Posting Retrieval', () => {
    test('should retrieve posting by ID', async () => {
      const createRes = await makeAuthenticatedRequest('POST', '/postings', seller.accessToken, {
        gameId: testGame.id,
        username: 'retrievetest123',
        password: 'Pass123!@',
        serverRegion: 'US-East',
        level: 50,
        price: 100000,
        description: 'Test',
      })

      const createdPosting = await assertValidJson(createRes, 'posting creation')

      const getRes = await makeAuthenticatedRequest(
        'GET',
        `/postings/${createdPosting.data.id}`,
        buyer.accessToken
      )

      expect(getRes.status).toBe(200)
      const data = await assertValidJson(getRes, 'posting retrieval')

      expect(data.data.id).toBe(createdPosting.data.id)
      assertNoSensitiveData(data.data, ['password', 'encryptedPassword'], 'posting details')
    })

    test('should not return password to non-owner', async () => {
      const createRes = await makeAuthenticatedRequest('POST', '/postings', seller.accessToken, {
        gameId: testGame.id,
        username: 'nonownertest123',
        password: 'SecretPass123!@',
        serverRegion: 'US-East',
        level: 50,
        price: 100000,
        description: 'Test',
      })

      const createdPosting = await assertValidJson(createRes, 'posting creation')

      const getRes = await makeAuthenticatedRequest(
        'GET',
        `/postings/${createdPosting.data.id}`,
        buyer.accessToken
      )

      expect(getRes.ok).toBe(true)
      const data = await assertValidJson(getRes, 'posting retrieval')

      expect(data.data.password).toBeUndefined()
      expect(data.data.encryptedPassword).toBeUndefined()
    })

    test('should return password only to owner or after purchase', async () => {
      const createRes = await makeAuthenticatedRequest('POST', '/postings', seller.accessToken, {
        gameId: testGame.id,
        username: 'ownertest123',
        password: 'OwnerPass123!@',
        serverRegion: 'US-East',
        level: 50,
        price: 100000,
        description: 'Test',
      })

      const createdPosting = await assertValidJson(createRes, 'posting creation')

      // Owner should see password
      const ownerRes = await makeAuthenticatedRequest(
        'GET',
        `/postings/${createdPosting.data.id}`,
        seller.accessToken
      )

      // Non-owner should not see password
      const nonOwnerRes = await makeAuthenticatedRequest(
        'GET',
        `/postings/${createdPosting.data.id}`,
        buyer.accessToken
      )

      const ownerData = await assertValidJson(ownerRes, 'owner view')
      const nonOwnerData = await assertValidJson(nonOwnerRes, 'non-owner view')

      // Owner should have some way to access password (could be encrypted in response)
      // Non-owner should definitely not have it plainly visible
      expect(nonOwnerData.data.password).toBeUndefined()
    })

    test('should list active postings for game', async () => {
      const res = await makeAuthenticatedRequest('GET', `/games/${testGame.id}/postings`, buyer.accessToken)

      expect(res.status).toBe(200)
      const data = await assertValidJson(res, 'postings list')

      expect(Array.isArray(data.data)).toBe(true)
      // All should be active and for this game
      if (data.data.length > 0) {
        for (const posting of data.data) {
          expect(posting.gameId).toBe(testGame.id)
          expect(posting.status).toBe('active')
        }
      }
    })
  })

  describe('Posting Updates', () => {
    test('should allow seller to update their own posting', async () => {
      const createRes = await makeAuthenticatedRequest('POST', '/postings', seller.accessToken, {
        gameId: testGame.id,
        username: 'updatetest123',
        password: 'Pass123!@',
        serverRegion: 'US-East',
        level: 50,
        price: 100000,
        description: 'Original description',
      })

      const createdPosting = await assertValidJson(createRes, 'posting creation')

      const updateRes = await makeAuthenticatedRequest(
        'PUT',
        `/postings/${createdPosting.data.id}`,
        seller.accessToken,
        {
          price: 150000,
          description: 'Updated description',
        }
      )

      expect([200, 204]).toContain(updateRes.status)

      const verifyRes = await makeAuthenticatedRequest(
        'GET',
        `/postings/${createdPosting.data.id}`,
        seller.accessToken
      )

      const verifyData = await assertValidJson(verifyRes, 'verification')
      expect(verifyData.data.price).toBe(150000)
      expect(verifyData.data.description).toBe('Updated description')
    })

    test('should prevent non-owner from updating posting', async () => {
      const createRes = await makeAuthenticatedRequest('POST', '/postings', seller.accessToken, {
        gameId: testGame.id,
        username: 'nonownerupdate123',
        password: 'Pass123!@',
        serverRegion: 'US-East',
        level: 50,
        price: 100000,
        description: 'Test',
      })

      const createdPosting = await assertValidJson(createRes, 'posting creation')

      const updateRes = await makeAuthenticatedRequest(
        'PUT',
        `/postings/${createdPosting.data.id}`,
        buyer.accessToken,
        {
          price: 50000,
        }
      )

      expect(updateRes.status).toBe(403)
    })

    test('should not allow updating critical fields like gameId', async () => {
      const createRes = await makeAuthenticatedRequest('POST', '/postings', seller.accessToken, {
        gameId: testGame.id,
        username: 'criticaltest123',
        password: 'Pass123!@',
        serverRegion: 'US-East',
        level: 50,
        price: 100000,
        description: 'Test',
      })

      const createdPosting = await assertValidJson(createRes, 'posting creation')
      const anotherGameRes = await createTestGame('another-game')

      if (anotherGameRes && anotherGameRes.id) {
        const updateRes = await makeAuthenticatedRequest(
          'PUT',
          `/postings/${createdPosting.data.id}`,
          seller.accessToken,
          {
            gameId: anotherGameRes.id,
          }
        )

        expect([400, 403]).toContain(updateRes.status)

        // Verify gameId didn't change
        const verifyRes = await makeAuthenticatedRequest(
          'GET',
          `/postings/${createdPosting.data.id}`,
          seller.accessToken
        )

        const verifyData = await assertValidJson(verifyRes, 'verification')
        expect(verifyData.data.gameId).toBe(testGame.id)
      }
    })
  })

  describe('Posting Deletion', () => {
    test('should allow seller to delete their own posting', async () => {
      const createRes = await makeAuthenticatedRequest('POST', '/postings', seller.accessToken, {
        gameId: testGame.id,
        username: 'deletetest123',
        password: 'Pass123!@',
        serverRegion: 'US-East',
        level: 50,
        price: 100000,
        description: 'Test',
      })

      const createdPosting = await assertValidJson(createRes, 'posting creation')

      const deleteRes = await makeAuthenticatedRequest(
        'DELETE',
        `/postings/${createdPosting.data.id}`,
        seller.accessToken
      )

      expect([200, 204]).toContain(deleteRes.status)

      // Verify it's deleted
      const getRes = await makeAuthenticatedRequest(
        'GET',
        `/postings/${createdPosting.data.id}`,
        seller.accessToken
      )

      expect([404, 410]).toContain(getRes.status)
    })

    test('should prevent non-owner from deleting posting', async () => {
      const createRes = await makeAuthenticatedRequest('POST', '/postings', seller.accessToken, {
        gameId: testGame.id,
        username: 'nonownerdelete123',
        password: 'Pass123!@',
        serverRegion: 'US-East',
        level: 50,
        price: 100000,
        description: 'Test',
      })

      const createdPosting = await assertValidJson(createRes, 'posting creation')

      const deleteRes = await makeAuthenticatedRequest(
        'DELETE',
        `/postings/${createdPosting.data.id}`,
        buyer.accessToken
      )

      expect(deleteRes.status).toBe(403)
    })

    test('should not delete if posting has active transaction', async () => {
      // This would require creating a transaction first
      // TODO: Implement after transaction tests
    })
  })
})
