import { getApp, clearRateLimits, clearDatabase } from './test-setup'
import { registerAndLoginUser } from './utils'
import { db } from '@/db'
import { createId } from '@paralleldrive/cuid2'

async function test() {
  await clearRateLimits()
  await clearDatabase()
  const app = getApp()
  
  const buyer = await registerAndLoginUser('user')
  const seller = await registerAndLoginUser('verified_seller')
  
  const gameData = await db`
    INSERT INTO games (name, platform, genre, is_active)
    VALUES (${`Trans Test - ${createId()}`}, 'Mobile', 'MOBA', true)
    RETURNING *
  `;
  
  // Create posting as seller
  const postingData = {
    game_id: gameData[0].id,
    account_identifier: 'test-account',
    price: 125000,
    description: 'Test Account',
    field_values: { level: 50 },
    cover_image_url: null
  }
  
  const createRes = await app.handle(
    new Request('http://localhost/postings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${seller.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postingData),
    })
  )
  
  console.log('Create posting status:', createRes.status)
  const postingBody = await createRes.json()
  console.log('Posting created:', postingBody)
  const postingId = postingBody.data.id
  
  // Try to purchase
  const purchaseRes = await app.handle(
    new Request('http://localhost/transactions/purchase', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${buyer.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ gameAccountId: postingId }),
    })
  )
  
  console.log('Purchase status:', purchaseRes.status)
  const text = await purchaseRes.text()
  console.log('Purchase response:', text.substring(0, 500))
}

test().catch(console.error).finally(() => process.exit(0))
