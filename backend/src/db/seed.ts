import { db } from './index'
import { games, gameFieldDefinitions } from './schema'
import { logger } from '@/libs/logger'

async function seed() {
  logger.info('Starting database seed...')

  try {
    // Insert games
    const gamesData = await db
      .insert(games)
      .values([
        {
          name: 'Mobile Legends',
          slug: 'mobile-legends',
          description: 'Popular MOBA game for mobile',
          isActive: true,
        },
        {
          name: 'Free Fire',
          slug: 'free-fire',
          description: 'Battle royale game',
          isActive: true,
        },
        {
          name: 'PUBG Mobile',
          slug: 'pubg-mobile',
          description: 'Battle royale game',
          isActive: true,
        },
        {
          name: 'Roblox',
          slug: 'roblox',
          description: 'Online game platform and game creation system',
          isActive: true,
        },
        {
          name: 'eFootball',
          slug: 'efootball',
          description: 'Football simulation game',
          isActive: true,
        },
      ])
      .returning()

    logger.success(`Inserted ${gamesData.length} games`)

    // Get game IDs
    const mlGame = gamesData.find((g) => g.slug === 'mobile-legends')!
    const ffGame = gamesData.find((g) => g.slug === 'free-fire')!
    const pubgGame = gamesData.find((g) => g.slug === 'pubg-mobile')!
    const robloxGame = gamesData.find((g) => g.slug === 'roblox')!
    const efootballGame = gamesData.find((g) => g.slug === 'efootball')!

    // Insert field definitions
    const fieldDefinitionsData = await db
      .insert(gameFieldDefinitions)
      .values([
        // Mobile Legends fields
        {
          gameId: mlGame.id,
          fieldName: 'level',
          fieldLabel: 'Level',
          fieldType: 'number',
          isRequired: true,
          displayOrder: 1,
        },
        {
          gameId: mlGame.id,
          fieldName: 'rank',
          fieldLabel: 'Rank',
          fieldType: 'select',
          fieldOptions: ['Warrior', 'Elite', 'Master', 'Grandmaster', 'Epic', 'Legend', 'Mythic', 'Mythical Glory'],
          isRequired: true,
          displayOrder: 2,
        },
        {
          gameId: mlGame.id,
          fieldName: 'total_heroes',
          fieldLabel: 'Total Heroes',
          fieldType: 'number',
          isRequired: true,
          displayOrder: 3,
        },
        {
          gameId: mlGame.id,
          fieldName: 'total_skins',
          fieldLabel: 'Total Skins',
          fieldType: 'number',
          isRequired: true,
          displayOrder: 4,
        },
        {
          gameId: mlGame.id,
          fieldName: 'emblems',
          fieldLabel: 'Max Emblem Level',
          fieldType: 'number',
          isRequired: false,
          displayOrder: 5,
        },

        // Free Fire fields
        {
          gameId: ffGame.id,
          fieldName: 'level',
          fieldLabel: 'Level',
          fieldType: 'number',
          isRequired: true,
          displayOrder: 1,
        },
        {
          gameId: ffGame.id,
          fieldName: 'rank',
          fieldLabel: 'Rank',
          fieldType: 'select',
          fieldOptions: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Heroic', 'Grandmaster'],
          isRequired: true,
          displayOrder: 2,
        },
        {
          gameId: ffGame.id,
          fieldName: 'diamonds',
          fieldLabel: 'Diamonds',
          fieldType: 'number',
          isRequired: false,
          displayOrder: 3,
        },

        // PUBG Mobile fields
        {
          gameId: pubgGame.id,
          fieldName: 'level',
          fieldLabel: 'Level',
          fieldType: 'number',
          isRequired: true,
          displayOrder: 1,
        },
        {
          gameId: pubgGame.id,
          fieldName: 'tier',
          fieldLabel: 'Tier',
          fieldType: 'select',
          fieldOptions: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Crown', 'Ace', 'Conqueror'],
          isRequired: true,
          displayOrder: 2,
        },
        {
          gameId: pubgGame.id,
          fieldName: 'uc',
          fieldLabel: 'UC (Currency)',
          fieldType: 'number',
          isRequired: false,
          displayOrder: 3,
        },

        // Roblox fields
        {
          gameId: robloxGame.id,
          fieldName: 'username',
          fieldLabel: 'Username',
          fieldType: 'text',
          isRequired: true,
          displayOrder: 1,
        },
        {
          gameId: robloxGame.id,
          fieldName: 'robux',
          fieldLabel: 'Robux',
          fieldType: 'number',
          isRequired: false,
          displayOrder: 2,
        },
        {
          gameId: robloxGame.id,
          fieldName: 'limited_items',
          fieldLabel: 'Limited Items',
          fieldType: 'number',
          isRequired: false,
          displayOrder: 3,
        },

        // eFootball fields
        {
          gameId: efootballGame.id,
          fieldName: 'team_strength',
          fieldLabel: 'Team Strength',
          fieldType: 'number',
          isRequired: true,
          displayOrder: 1,
        },
        {
          gameId: efootballGame.id,
          fieldName: 'efootball_coins',
          fieldLabel: 'eFootball Coins',
          fieldType: 'number',
          isRequired: false,
          displayOrder: 2,
        },
        {
          gameId: efootballGame.id,
          fieldName: 'legendary_players',
          fieldLabel: 'Legendary Players',
          fieldType: 'number',
          isRequired: false,
          displayOrder: 3,
        },
      ])
      .returning()

    logger.success(`Inserted ${fieldDefinitionsData.length} field definitions`)
    logger.success('✅ Database seed completed!')
  } catch (error) {
    logger.error('Seed failed', error)
    throw error
  } finally {
    process.exit(0)
  }
}

seed()