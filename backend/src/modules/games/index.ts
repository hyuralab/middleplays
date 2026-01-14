import { Elysia } from 'elysia'
import { listActiveGames, getGameFields } from './service'
import { successResponse, handleRoute, logSuccess } from '@/libs/route-helpers'

export const gamesModule = new Elysia({ prefix: '/games', name: 'games-module' })
  // This module is public, no authentication needed.

  // ==================== LIST ALL ACTIVE GAMES ====================
  .get(
    '/',
    handleRoute(async () => {
      const games = await listActiveGames()
      logSuccess('Fetched active games', { count: games.length })
      return successResponse(games)
    }),
    {
      detail: {
        tags: ['Games'],
        summary: 'Get a list of all active games',
      },
    }
  )

  // ==================== GET GAME-SPECIFIC FIELDS ====================
  .get(
    '/:gameId/fields',
    handleRoute(async (context: any) => {
      const gameId = Number(context.params.gameId)
      const fields = await getGameFields(gameId)
      logSuccess('Fetched game fields', { gameId, fieldCount: fields.length })
      return successResponse(fields)
    }),
    {
      detail: {
        tags: ['Games'],
        summary: 'Get the dynamic field definitions for a specific game',
      },
    }
  )
