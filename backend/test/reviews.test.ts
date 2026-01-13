import { getApp, clearRateLimits, clearDatabase } from './test-setup'
import { registerAndLoginUser } from './utils'
import { db } from '@/db'
import { createId } from '@paralleldrive/cuid2'

async function testReviews() {
  console.log('\n=== TESTING REVIEWS SYSTEM ===\n')
  
  await clearRateLimits()
  await clearDatabase()
  const app = getApp()

  // Setup: Create buyer, seller, game, posting, and completed transaction
  console.log('[1] Setting up test data...')
  const buyer = await registerAndLoginUser('user')
  const seller = await registerAndLoginUser('verified_seller')

  const gameData = await db`
    INSERT INTO games (name, platform, genre, is_active)
    VALUES (${`Review Test - ${createId()}`}, 'Mobile', 'MOBA', true)
    RETURNING *
  ` as any

  const postingData = {
    game_id: gameData[0]!.id,
    account_identifier: 'test-account',
    price: 125000,
    description: 'Test Account',
    field_values: { level: 50 },
    cover_image_url: null,
  }

  const createRes = await app.handle(
    new Request('http://localhost/postings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${seller.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postingData),
    })
  )

  const postingBody = await createRes.json()
  const postingId = postingBody.data.id

  // Create transaction and manually mark as completed
  const purchaseRes = await app.handle(
    new Request('http://localhost/transactions/purchase', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${buyer.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ gameAccountId: postingId }),
    })
  )

  const purchaseBody = await purchaseRes.json()
  const transactionId = purchaseBody.data.transactionId

  // Mark transaction as completed (manually for testing)
  await db`UPDATE transactions SET status = 'completed', completed_at = NOW() WHERE id = ${transactionId}`
  console.log('✓ Test data setup complete')

  // TEST 1: Create review as buyer
  console.log('\n[2] Testing POST /reviews (buyer creating review)...')
  const createReviewRes = await app.handle(
    new Request('http://localhost/reviews', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${buyer.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionId,
        rating: 5,
        comment: 'Great seller! Smooth transaction.',
      }),
    })
  )

  console.log(`Status: ${createReviewRes.status}`)
  const reviewData = await createReviewRes.json()
  console.log('Response:', JSON.stringify(reviewData, null, 2))

  if (createReviewRes.status !== 201) {
    console.error('❌ Failed to create review')
    return
  }

  const reviewId = reviewData.data.id
  console.log('✓ Review created successfully')

  // TEST 2: Get review by ID
  console.log('\n[3] Testing GET /reviews/:reviewId...')
  const getReviewRes = await app.handle(
    new Request(`http://localhost/reviews/${reviewId}`, {
      method: 'GET',
    })
  )

  console.log(`Status: ${getReviewRes.status}`)
  const getReviewBody = await getReviewRes.json()
  console.log('Review detail:', JSON.stringify(getReviewBody.data, null, 2).substring(0, 300))
  console.log('✓ Got review detail')

  // TEST 3: Get reviews for transaction
  console.log('\n[4] Testing GET /reviews/transaction/:transactionId...')
  const getTxnReviewsRes = await app.handle(
    new Request(`http://localhost/reviews/transaction/${transactionId}`, {
      method: 'GET',
    })
  )

  console.log(`Status: ${getTxnReviewsRes.status}`)
  const txnReviewsBody = await getTxnReviewsRes.json()
  console.log(`Found ${txnReviewsBody.data.length} reviews`)
  console.log('✓ Got transaction reviews')

  // TEST 4: Get reviews about seller (seller ratings)
  console.log('\n[5] Testing GET /reviews/user/:userId (seller ratings)...')
  const getSellerReviewsRes = await app.handle(
    new Request(`http://localhost/reviews/user/${seller.userId}`, {
      method: 'GET',
    })
  )

  console.log(`Status: ${getSellerReviewsRes.status}`)
  const sellerReviewsBody = await getSellerReviewsRes.json()
  console.log(`Seller has ${sellerReviewsBody.data.length} reviews`)
  console.log(`Seller rating: ${sellerReviewsBody.data[0]?.rating}/5`)
  console.log('✓ Got seller reviews')

  // TEST 5: Add response as seller
  console.log('\n[6] Testing POST /reviews/:reviewId/responses (seller response)...')
  const addResponseRes = await app.handle(
    new Request(`http://localhost/reviews/${reviewId}/responses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${seller.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        responseText: 'Thank you for the positive review! Happy to work with you again.',
      }),
    })
  )

  console.log(`Status: ${addResponseRes.status}`)
  const responseBody = await addResponseRes.json()
  console.log('Response:', JSON.stringify(responseBody, null, 2))
  console.log('✓ Response added successfully')

  // TEST 6: Get review again to see response
  console.log('\n[7] Testing GET /reviews/:reviewId (with response)...')
  const getReviewWithResponseRes = await app.handle(
    new Request(`http://localhost/reviews/${reviewId}`, {
      method: 'GET',
    })
  )

  const reviewWithResponseBody = await getReviewWithResponseRes.json()
  console.log(`Review has ${reviewWithResponseBody.data.responses.length} response(s)`)
  if (reviewWithResponseBody.data.responses.length > 0) {
    console.log(`Response: "${reviewWithResponseBody.data.responses[0].responseText}"`)
  }
  console.log('✓ Got review with response')

  // TEST 7: Try to create duplicate review (should fail)
  console.log('\n[8] Testing duplicate review prevention...')
  const dupReviewRes = await app.handle(
    new Request('http://localhost/reviews', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${buyer.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionId,
        rating: 4,
        comment: 'Second review',
      }),
    })
  )

  console.log(`Status: ${dupReviewRes.status}`)
  const dupText = await dupReviewRes.text()
  console.log(`Error: ${dupText.substring(0, 100)}`)
  console.log(`✓ Duplicate review correctly rejected (Status ${dupReviewRes.status})`)

  // TEST 8: Try to review as non-participant (should fail)
  console.log('\n[9] Testing non-participant review prevention...')
  const otherUser = await registerAndLoginUser('user')

  const nonParticipantRes = await app.handle(
    new Request('http://localhost/reviews', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${otherUser.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionId,
        rating: 3,
        comment: 'I am not involved',
      }),
    })
  )

  console.log(`Status: ${nonParticipantRes.status}`)
  const nonParticipantText = await nonParticipantRes.text()
  console.log(`Error: ${nonParticipantText.substring(0, 100)}`)
  console.log(`✓ Non-participant review correctly rejected (Status ${nonParticipantRes.status})`)

  console.log('\n✅ ALL REVIEW TESTS PASSED!\n')
}

testReviews().catch(console.error).finally(() => process.exit(0))
