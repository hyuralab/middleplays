import { Elysia } from 'elysia'
import { jwtPlugin } from '@/plugins/jwt'
import type { JWTPayloadSpec } from '@elysiajs/jwt'

interface JWTPayload extends JWTPayloadSpec {
  userId: string
  type: 'access' | 'refresh'
}

// 1. Tambahkan { as: 'global' } supaya userId & user tersedia di plugin lain
export const authMiddleware = new Elysia({ name: 'auth' })
  .use(jwtPlugin)
  .derive({ as: 'global' }, async ({ request, jwt }) => {
    const auth = request.headers.get('authorization')

    if (!auth || !auth.startsWith('Bearer ')) {
      return { user: null, userId: null }
    }

    const token = auth.slice(7)

    try {
      const payload = (await jwt.verify(token)) as unknown as JWTPayload | false

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

// 2. Gunakan pattern plugin yang konsisten
export const requireAuth = new Elysia({ name: 'require-auth' })
  .use(authMiddleware)
  .guard(
    {
      beforeHandle({ userId, set }) {
        if (!userId) {
          set.status = 401
          return false
        }
      },
    },
    (app) =>
      app.onError(({ set }) => {
        set.status = 401
        return {
          success: false,
          error: 'Unauthorized',
          message: 'Unauthorized. Please login.',
        }
      })
  )



// 3. Gunakan { as: 'global' } juga di sini agar sellerUser bisa dipake di route
export const requireVerifiedSeller = new Elysia({ name: 'require-verified-seller' })
  .use(requireAuth)
  .derive({ as: 'global' }, async ({ userId }) => {
    const { db } = await import('@/db')

    const users = await db`SELECT id, role FROM users WHERE id = ${userId!}`
    const user = users && users.length > 0 ? users[0] : null

    // Return both user and isVerifiedSeller flag
    return { 
      sellerUser: user || null,
      isVerifiedSeller: user && user.role === 'seller' ? true : false
    }
  })