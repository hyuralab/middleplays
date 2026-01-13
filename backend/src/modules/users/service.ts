import { db } from '@/db'
import { UserRole } from '@/types'
import { logger } from '@/libs/logger'
import { verifyPassword, hashPassword } from '@/libs/crypto'
import type { UpdateProfileRequest, ChangePasswordRequest } from './model'

/**
 * Get a user's full profile information.
 * @param userId - The ID of the user.
 */
export async function getUserProfile(userId: string) {
  const users = await db`
    SELECT u.id, u.email, u.role, u.is_verified, u.created_at, u.updated_at,
           p.user_id, p.full_name, p.phone, p.avatar_url, p.bio, p.city, p.country, p.updated_at as profile_updated_at
    FROM users u
    LEFT JOIN user_profiles p ON u.id = p.user_id
    WHERE u.id = ${userId}
  ` as any

  if (!users || users.length === 0) {
    throw new Error('User not found')
  }

  const user = users[0]

  if (!user.user_id) {
    throw new Error('User profile not found. Please contact support.')
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isVerified: user.is_verified,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    profile: {
      userId: user.user_id,
      fullName: user.full_name,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      city: user.city,
      country: user.country,
      updatedAt: user.profile_updated_at,
    }
  }
}

/**
 * Update a user's profile.
 * @param userId - The ID of the user.
 * @param data - The profile data to update.
 */
export async function updateUserProfile(userId: number, data: UpdateProfileRequest) {
  if (Object.keys(data).length === 0) {
    throw new Error('No fields to update.')
  }
  
  try {
    // Use template literals for safe updates
    const updates = await db`
      UPDATE user_profiles
      SET 
        full_name = COALESCE(${data.fullName || null}, full_name),
        phone = COALESCE(${data.phone || null}, phone),
        updated_at = NOW()
      WHERE user_id = ${userId}
      RETURNING id, user_id, full_name, phone, avatar_url, bio, city, country, created_at, updated_at
    `

    if (!updates || updates.length === 0) {
      throw new Error('Profile not found or failed to update.')
    }

    logger.info(`User profile updated for user: ${userId}`)
    return updates[0]!

  } catch (error) {
    logger.error(`Failed to update profile for user ${userId}`, error)
    throw new Error('Profile update failed.')
  }
}

/**
 * Change a user's password.
 * @param userId - The ID of the user.
 * @param data - The old and new password data.
 */
export async function changeUserPassword(userId: string, data: ChangePasswordRequest) {
  const users = await db`
    SELECT id, password_hash FROM users WHERE id = ${userId}
  ` as any

  if (!users || users.length === 0) {
    // This should ideally not happen if the user is authenticated
    throw new Error('User not found')
  }

  const user = users[0]

  // 1. Verify the old password
  const isOldPasswordValid = await verifyPassword(data.oldPassword, user.password_hash)
  if (!isOldPasswordValid) {
    throw new Error('Invalid old password.')
  }

  // 2. Hash the new password
  const newPasswordHash = await hashPassword(data.newPassword)

  // 3. Update the user's password in the database
  try {
    await db`
      UPDATE users 
      SET password_hash = ${newPasswordHash}, updated_at = NOW() 
      WHERE id = ${userId}
    `
    
    logger.info(`Password changed successfully for user: ${userId}`)

    // In a real application, you might want to send a notification email here.
    logger.info(`
      ================================================
      VIRTUAL EMAIL - PASSWORD CHANGE NOTIFICATION
      ------------------------------------------------
      To: ${user.email}
      Your password has been changed successfully.
      If you did not make this change, please contact support immediately.
      ================================================
    `);

  } catch (error) {
    logger.error(`Failed to change password for user ${userId}`, error);
    throw new Error('Failed to change password.');
  }
}
