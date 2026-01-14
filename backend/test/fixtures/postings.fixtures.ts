import { createId } from '@paralleldrive/cuid2'

export const createTestGame = (overrides = {}) => ({
  name: `Test Game ${createId()}`,
  description: 'A test game for testing purposes',
  developer: 'Test Developer',
  releaseDate: '2024-01-01',
  ...overrides,
})

export const createTestPosting = (gameId: string, userId: string, overrides = {}) => ({
  gameId,
  accountId: createId(),
  username: `testaccount_${createId()}`,
  password: 'SecurePass123!@#',
  serverRegion: 'US-East',
  level: 50,
  price: 100000,
  description: 'Test account for sale',
  status: 'active',
  ...overrides,
})

export const invalidPostingData = {
  // Negative price
  negativePrice: {
    price: -1000,
  },
  // Zero price
  zeroPrice: {
    price: 0,
  },
  // Extremely high price
  highPrice: {
    price: 999999999999,
  },
  // Invalid level
  negativeLeve: {
    level: -1,
  },
  // Empty username
  emptyUsername: {
    username: '',
  },
  // Empty password
  emptyPassword: {
    password: '',
  },
  // SQL injection in description
  sqlInjectionDesc: {
    description: "'; DROP TABLE game_accounts; --",
  },
  // Very long description
  longDescription: {
    description: 'a'.repeat(50000),
  },
  // Invalid server region
  invalidRegion: {
    serverRegion: '<script>alert("xss")</script>',
  },
  // Missing required fields
  missingGameId: {},
  missingUsername: {
    username: null,
  },
  missingPrice: {
    price: null,
  },
}
