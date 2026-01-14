import { db } from '@/db'
import { PostingStatus, LoginMethod } from '@/types'
import { logger } from '@/libs/logger'
import { fetchOne, fetchMany, calculatePagination, parsePagination } from '@/libs/query-helpers'
import { encryptCredentials } from '@/libs/crypto'
import type { CreatePostingRequest, ListPostingsQuery } from './model'

async function validatePostingDetails(gameId: number, details: Record<string, any>) {
  try {
    const fieldDefs = await db`
      SELECT * FROM game_field_definitions
      WHERE game_id = ${gameId}
    `;

    if (fieldDefs.length === 0) {
      logger.warn(`No field definitions found for game ${gameId}`);
      return;
    }

    const requiredFields = fieldDefs.filter((f: any) => f.is_required);
    for (const field of requiredFields) {
      if (!(field.field_name in details)) {
        throw new Error(`Required field '${field.field_name}' is missing.`);
      }
      
      const value = details[field.field_name];
      if (field.field_type === 'number' && typeof value !== 'number') {
        throw new Error(`Field '${field.field_name}' must be a number.`);
      }
    }

    logger.info(`Posting details validated successfully for game ${gameId}`);
  } catch (error) {
    logger.error('Failed to validate posting details', error);
    throw error;
  }
}

export async function createPosting(sellerId: number, data: CreatePostingRequest) {
  try {
    const game = await fetchOne(
      db`SELECT * FROM games WHERE id = ${data.game_id}`,
      'Game not found or inactive.',
      'Failed to find game for posting'
    ) as any

    if (!game.is_active) {
      throw new Error('Game not found or inactive.')
    }

    await validatePostingDetails(data.game_id, data.field_values || {})

    const posting = await fetchOne(
      db`
        INSERT INTO game_accounts (
          seller_id,
          game_id,
          account_identifier,
          price,
          description,
          field_values,
          cover_image_url,
          status,
          created_at,
          updated_at
        ) VALUES (
          ${sellerId},
          ${data.game_id},
          ${data.account_identifier},
          ${data.price},
          ${data.description || null},
          ${JSON.stringify(data.field_values || {})},
          ${data.cover_image_url || null},
          'active',
          NOW(),
          NOW()
        )
        RETURNING *
      `,
      'Failed to create posting.',
      'Failed to insert posting'
    ) as any

    logger.info(`New posting created: ${posting.id} by seller ${sellerId}`)
    return posting

  } catch (error) {
    logger.error('Failed to create posting', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Could not create posting.');
  }
}

export async function listPostings(query: ListPostingsQuery) {
  const { page = 1, limit = 20, game_id, seller_id, minPrice, maxPrice, sortBy = 'newest', search } = query
  const { offset } = parsePagination(page, limit)

  try {
    // Build WHERE conditions
    let whereConditions: any[] = [db`ga.status = 'active'`]
    if (game_id) whereConditions.push(db`ga.game_id = ${game_id}`)
    if (seller_id) whereConditions.push(db`ga.seller_id = ${seller_id}`)
    if (minPrice) whereConditions.push(db`ga.price >= ${minPrice}`)
    if (maxPrice) whereConditions.push(db`ga.price <= ${maxPrice}`)
    if (search) whereConditions.push(db`ga.account_identifier ILIKE ${'%' + search + '%'}`)

    // Combine conditions
    let whereClause = whereConditions[0]
    for (let i = 1; i < whereConditions.length; i++) {
      whereClause = db`${whereClause} AND ${whereConditions[i]}`
    }

    // Determine ORDER BY
    let orderBy = 'ga.created_at DESC'
    if (sortBy === 'price_asc') orderBy = 'ga.price ASC'
    else if (sortBy === 'price_desc') orderBy = 'ga.price DESC'
    else if (sortBy === 'oldest') orderBy = 'ga.created_at ASC'

    const postings = await fetchMany(
      db.unsafe(`
        SELECT
          ga.id,
          ga.account_identifier,
          ga.price,
          ga.description,
          ga.field_values,
          ga.cover_image_url,
          ga.status,
          ga.created_at,
          g.name as game_name,
          u.username as seller_username,
          u.id as seller_id,
          up.full_name as seller_full_name,
          up.avatar_url as seller_avatar_url,
          ss.average_rating as seller_rating
        FROM game_accounts ga
        LEFT JOIN games g ON ga.game_id = g.id
        LEFT JOIN users u ON ga.seller_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        LEFT JOIN seller_stats ss ON u.id = ss.user_id
        WHERE ${whereClause}
        ORDER BY ${orderBy}
        LIMIT ${limit} OFFSET ${offset}
      `) as any,
      '',
      true
    ) as any[]

    const countResult = await fetchMany(
      db.unsafe(`SELECT COUNT(*) as total FROM game_accounts ga WHERE ${whereClause}`) as any,
      '',
      false
    ) as any[]

    const total = Number(countResult[0]?.total || 0)
    const { totalPages } = calculatePagination(page, limit, total)

    return {
      success: true,
      data: postings,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    }

  } catch (error) {
    logger.error('Failed to list postings', error);
    throw new Error('Could not fetch postings.');
  }
}

export async function getPosting(postingId: number) {
  try {
    const result = await db`
      SELECT
        ga.id,
        ga.account_identifier,
        ga.price,
        ga.description,
        ga.field_values,
        ga.cover_image_url,
        ga.status,
        ga.created_at,
        ga.updated_at,
        g.name as game_name,
        u.username as seller_username,
        u.id as seller_id,
        up.full_name as seller_full_name,
        up.avatar_url as seller_avatar_url,
        ss.average_rating as seller_rating
      FROM game_accounts ga
      LEFT JOIN games g ON ga.game_id = g.id
      LEFT JOIN users u ON ga.seller_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN seller_stats ss ON u.id = ss.user_id
      WHERE ga.id = ${postingId}
    `;

    return result[0] || null;
  } catch (error) {
    logger.error(`Failed to get posting ${postingId}`, error);
    throw new Error('Could not fetch posting.');
  }
}

export async function updatePosting(postingId: number, sellerId: number, data: Partial<CreatePostingRequest>) {
  try {
    // Verify ownership
    const posting = await db`
      SELECT seller_id FROM game_accounts WHERE id = ${postingId}
    `;

    if (!posting || posting.length === 0 || !posting[0] || posting[0].seller_id !== sellerId) {
      throw new Error('Posting not found or not owned by this seller.');
    }

    if (data.description !== undefined) {
      await db`
        UPDATE game_accounts
        SET description = ${data.description}, updated_at = NOW()
        WHERE id = ${postingId}
      `;
    }

    if (data.price !== undefined) {
      await db`
        UPDATE game_accounts
        SET price = ${data.price}, updated_at = NOW()
        WHERE id = ${postingId}
      `;
    }

    if (data.field_values !== undefined) {
      await db`
        UPDATE game_accounts
        SET field_values = ${JSON.stringify(data.field_values)}, updated_at = NOW()
        WHERE id = ${postingId}
      `;
    }

    if (data.cover_image_url !== undefined) {
      await db`
        UPDATE game_accounts
        SET cover_image_url = ${data.cover_image_url}, updated_at = NOW()
        WHERE id = ${postingId}
      `;
    }

    logger.info(`Posting ${postingId} updated by seller ${sellerId}`);
    return await getPosting(postingId);

  } catch (error) {
    logger.error(`Failed to update posting ${postingId}`, error);
    throw error;
  }
}

export async function deletePosting(postingId: number, sellerId: number) {
  try {
    // Verify ownership
    const posting = await db`
      SELECT seller_id FROM game_accounts WHERE id = ${postingId}
    `;

    if (!posting || posting.length === 0 || !posting[0] || posting[0].seller_id !== sellerId) {
      throw new Error('Posting not found or not owned by this seller.');
    }

    await db`
      DELETE FROM game_accounts WHERE id = ${postingId}
    `;

    logger.info(`Posting ${postingId} deleted by seller ${sellerId}`);
    return true;

  } catch (error) {
    logger.error(`Failed to delete posting ${postingId}`, error);
    throw error;
  }
}