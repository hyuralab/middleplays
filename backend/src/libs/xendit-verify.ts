import crypto from 'crypto'

/**
 * Verify Xendit webhook signature
 * Prevents replay attacks and ensures webhook is from Xendit
 * 
 * Xendit signs webhooks using HMAC-SHA256 with the API secret key
 */
export function verifyXenditSignature(
  signature: string | null | undefined,
  payload: string,
  xenditApiSecret: string
): boolean {
  try {
    if (!signature || !xenditApiSecret) {
      return false
    }

    // Generate expected signature: HMAC-SHA256 of payload with API secret
    const expectedSignature = crypto
      .createHmac('sha256', xenditApiSecret)
      .update(payload)
      .digest('hex')

    // Constant-time comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expectedSignature)

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false
    }

    let mismatch = 0
    for (let i = 0; i < signatureBuffer.length; i++) {
      mismatch |= (signatureBuffer[i] ?? 0) ^ (expectedBuffer[i] ?? 0)
    }

    return mismatch === 0
  } catch (error) {
    return false
  }
}

/**
 * Validate Xendit webhook payload structure
 * Ensures required fields exist
 */
export function validateXenditWebhookPayload(payload: any): boolean {
  try {
    if (!payload) return false

    const requiredFields = ['id', 'external_id', 'status', 'amount']
    for (const field of requiredFields) {
      if (!(field in payload)) {
        return false
      }
    }

    return true
  } catch (error) {
    return false
  }
}
