import { Elysia } from 'elysia'
import type { JWTPayloadSpec } from '@elysiajs/jwt'

interface JWTPayload extends JWTPayloadSpec {
  userId: string
  type: 'access' | 'refresh'
}

export const authMiddleware = new Elysia({ name: 'auth' })
  .derive(async ({ request, jwt }) => {
    const auth = request.headers.get('authorization')

    if (!auth || !auth.startsWith('Bearer ')) {
      return { user: null, userId: null }
    }

    const token = auth.slice(7)

    try {
      const payload = await jwt.verify(token) as JWTPayload | false

      if (!payload || payload.type !== 'access') {
        return { user: null, userId: null }
      }

      return {
        user: payload,
        userId: payload.userId,
      }
    } catch {
      return { user: null, userId: null }
    }
  })

// Guard: Require authentication
export const requireAuth = new Elysia({ name: 'require-auth' })
  .use(authMiddleware)
  .onBeforeHandle(({ userId, set }) => {
    if (!userId) {
      set.status = 401
      throw new Error('Unauthorized. Please login.')
    }
  })

// Guard: Require verified seller
export const requireVerifiedSeller = new Elysia({ name: 'require-verified-seller' })
  .use(requireAuth)
  .derive(async ({ userId, set }) => {
    const { db } = await import('@/db')
    const { users } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId!),
    })

    if (!user || user.role !== 'verified_seller') {
      set.status = 403
      throw new Error('Access denied. Verified seller account required.')
    }

    return { sellerUser: user }
  })