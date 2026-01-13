import { getApp, clearRateLimits, clearDatabase } from './test-setup'
import { registerAndLoginUser } from './utils'
import { db } from '@/db'
import { createId } from '@paralleldrive/cuid2'

async function test() {
  await clearRateLimits()
  await clearDatabase()
  const app = getApp()
  
  const regularUser = await registerAndLoginUser('user')
  
  const gameData = await db`
    INSERT INTO games (name, platform, genre, is_active)
    VALUES (${`Test Game - ${createId()}`}, 'Mobile', 'MOBA', true)
    RETURNING *
  `;
  
  const postingData = {
    game_id: gameData[0].id,
    account_identifier: 'test-account',
    price: 10000,
    description: 'Test posting',
    field_values: { level: 50 },
    cover_image_url: null
  }
  
  const res = await app.handle(
    new Request('http://localhost/postings/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${regularUser.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postingData),
    })
  )
  
  console.log('Status:', res.status)
  console.log('Content-Type:', res.headers.get('content-type'))
  const text = await res.text()
  console.log('Response (first 300):', text.substring(0, 300))
}

test().catch(console.error).finally(() => process.exit(0))
