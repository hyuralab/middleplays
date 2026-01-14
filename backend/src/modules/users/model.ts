import { Type, Static } from '@sinclair/typebox'

// ==================== SCHEMAS ====================

export const userProfileSchema = Type.Object({
  id: Type.String(),
  email: Type.String(),
  role: Type.String(),
  isVerified: Type.Boolean(),
  createdAt: Type.Date(),
  profile: Type.Object({
    fullName: Type.Union([Type.String(), Type.Null()]),
    phone: Type.Union([Type.String(), Type.Null()]),
    avatarUrl: Type.Union([Type.String(), Type.Null()]),
    bio: Type.Union([Type.String(), Type.Null()]),
    city: Type.Union([Type.String(), Type.Null()]),
    country: Type.Union([Type.String(), Type.Null()]),
  })
})

export const updateProfileSchema = Type.Object({
  fullName: Type.Optional(Type.String({ minLength: 2, maxLength: 255 })),
  phone: Type.Optional(Type.String({ minLength: 10, maxLength: 20, pattern: '^[0-9+\\-\\s()]+$' })),
})

// ==================== RESPONSES ====================

export const userProfileResponseSchema = Type.Object({
  success: Type.Boolean(),
  data: userProfileSchema
})

export const genericSuccessResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String()
})


// ==================== TYPES ====================

export type UserProfileResponse = Static<typeof userProfileResponseSchema>
export type UpdateProfileRequest = Static<typeof updateProfileSchema>
