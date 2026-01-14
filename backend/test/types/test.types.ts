/**
 * Test Types - Strict typing for test suite
 */

export interface TestUser {
  userId: string | number
  email: string
  password: string
  role: 'user' | 'seller' | 'admin'
  accessToken: string
  refreshToken: string
}

export interface TestGame {
  id: string | number
  name: string
  description: string
  developer: string
  releaseDate: string
  createdAt?: string
  updatedAt?: string
}

export interface TestPosting {
  id: string | number
  gameId: string | number
  sellerId: string | number
  username: string
  password?: string
  serverRegion: string
  level: number
  price: number
  description: string
  status: 'active' | 'sold' | 'expired' | 'deleted'
  createdAt?: string
  updatedAt?: string
}

export interface TestTransaction {
  id: string | number
  postingId: string | number
  buyerId: string | number
  sellerId: string | number
  amount: number
  status: 'pending' | 'payment_processing' | 'completed' | 'disputed' | 'refunded'
  paymentMethod?: string
  xenditInvoiceId?: string
  createdAt?: string
  updatedAt?: string
}

export interface ApiResponse<T = any> {
  status?: 'ok' | 'success' | 'error'
  data?: T
  error?: {
    message: string
    code?: string
    details?: any
  }
  message?: string
}

export interface UserProfile {
  id: number
  userId: number
  fullName?: string
  bio?: string
  avatarUrl?: string
  phone?: string
  country?: string
  city?: string
  createdAt?: string
  updatedAt?: string
}

export interface DatabaseUser {
  id: number
  email: string
  username: string
  password?: string
  role?: 'user' | 'seller' | 'admin'
  googleId?: string
  googleName?: string
  googleAvatarUrl?: string
  createdAt?: string
  updatedAt?: string
}

export interface DatabasePosting {
  id: string | number
  gameId: string | number
  sellerId: string | number
  username: string
  password?: string
  serverRegion: string
  level: number
  price: number
  description: string
  status: string
  createdAt?: string
  updatedAt?: string
}

export type TestContext = {
  getApp: () => any
  cleanup: () => Promise<void>
}

export interface TestAssertion {
  field: string
  type: string
  required: boolean
  context?: string
}
