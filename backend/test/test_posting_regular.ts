import { getApp, clearRateLimits } from './test-setup'
import { registerAndLoginUser } from './utils'
import { db } from '@/db'
import { createId } from '@paralleldrive/cuid2'

async function test() {
  await clearRateLimits()
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
  
  console.log('Sending request with user token:', regularUser.accessToken.substring(0, 20) + '...')
  
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
  const text = await res.text()
  console.log('Response:', text.substring(0, 200))
}

test().catch(console.error).finally(() => process.exit(0))
