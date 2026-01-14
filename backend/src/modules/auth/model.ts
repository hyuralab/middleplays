import { Type, Static } from '@sinclair/typebox'

// ==================== REQUEST SCHEMAS ====================

export const googleLoginRequestSchema = Type.Object({
  googleToken: Type.String({
    minLength: 1,
    description: 'Google OAuth ID token from frontend',
  }),
})

export const refreshTokenRequestSchema = Type.Object({
  refreshToken: Type.String({
    minLength: 1,
  }),
})

// ==================== RESPONSE SCHEMAS ====================

export const googleAuthResponseSchema = Type.Object({
  success: Type.Boolean(),
  data: Type.Optional(Type.Object({
    user: Type.Object({
      id: Type.String(),
      email: Type.String(),
      name: Type.String(),
      avatarUrl: Type.Optional(Type.String()),
      role: Type.String(),
    }),
    accessToken: Type.String(),
    refreshToken: Type.String(),
  })),
  error: Type.Optional(Type.String()),
  message: Type.Optional(Type.String()),
})

export const refreshTokenResponseSchema = Type.Object({
  success: Type.Boolean(),
  data: Type.Optional(Type.Object({
    accessToken: Type.String(),
  })),
  error: Type.Optional(Type.String()),
  message: Type.Optional(Type.String()),
})

// ==================== TYPES ====================

export type GoogleLoginRequest = Static<typeof googleLoginRequestSchema>
export type RefreshTokenRequest = Static<typeof refreshTokenRequestSchema>

export type GoogleAuthResponse = Static<typeof googleAuthResponseSchema>
export type RefreshTokenResponse = Static<typeof refreshTokenResponseSchema>