import { db } from '@/db'
import { logger } from '@/libs/logger'

/**
 * Retrieves a list of all active games.
 */
export async function listActiveGames() {
  try {
    const activeGames = await db`
      SELECT id, name, slug, icon_url, description, is_active, created_at
      FROM games 
      WHERE is_active = true
      ORDER BY name ASC
    `
    return activeGames as any[] // Convert RowList to array
  } catch (error) {
    logger.error('Failed to retrieve active games', error)
    throw new Error('Could not fetch games list.')
  }
}

/**
 * Retrieves all field definitions for a specific game.
 * @param gameId - The ID of the game.
 */
export async function getGameFields(gameId: number) {
  try {
    const fieldDefinitions = await db`
      SELECT id, game_id, field_label, field_type, field_options, is_required, display_order, created_at
      FROM game_field_definitions 
      WHERE game_id = ${gameId}
      ORDER BY display_order ASC
    `

    if (fieldDefinitions.length === 0) {
      // It's not an error if a game has no fields, but it's good to know.
      // We first check if the game itself exists to provide a better error message.
      const gameExists = await db`
        SELECT id FROM games WHERE id = ${gameId}
      `
      if (!gameExists || gameExists.length === 0) {
        throw new Error('Game not found.')
      }
    }
    
    return fieldDefinitions as any[] // Convert RowList to array
  } catch (error) {
    logger.error(`Failed to retrieve game fields for gameId: ${gameId}`, error)
    if (error instanceof Error && error.message === 'Game not found.') {
        throw error
    }
    throw new Error('Could not fetch game fields.')
  }
}
