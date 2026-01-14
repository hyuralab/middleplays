import { randomBytes } from 'crypto'

/**
 * Generate unique dispute ID
 */
export function generateDisputeId(): string {
  return `disp_${Date.now()}_${randomBytes(8).toString('hex')}`
}

/**
 * Calculate auto-resolution date (30 days from now)
 */
export function getAutoResolutionDate(): Date {
  const date = new Date()
  date.setDate(date.getDate() + 30)
  return date
}

/**
 * Validate evidence URLs are accessible (simplified - skip validation for now)
 */
export async function validateEvidenceUrls(urls: string[]): Promise<boolean> {
  if (!urls || urls.length === 0) return true
  // URLs validation can be added later with AbortController timeout
  return true
}

/**
 * Calculate refund amount based on transaction details
 */
export function calculateRefundAmount(
  totalBuyerPaid: number,
  platformFeeAmount: number,
  refundPercentage: number
): { buyerRefund: number; sellerRefund: number; feesRefund: number } {
  const refundAmount = totalBuyerPaid * (refundPercentage / 100)
  const feesRefund = platformFeeAmount * (refundPercentage / 100)
  const sellerRefund = (totalBuyerPaid - platformFeeAmount) * (refundPercentage / 100)

  return {
    buyerRefund: refundAmount,
    sellerRefund,
    feesRefund,
  }
}

/**
 * Format dispute status for display
 */
export function formatDisputeStatus(status: string): string {
  const statusMap: Record<string, string> = {
    open: 'Open',
    in_review: 'In Review',
    resolved: 'Resolved',
    auto_resolved: 'Auto-Resolved',
    closed: 'Closed',
  }
  return statusMap[status] || status
}

/**
 * Format dispute reason for display
 */
export function formatDisputeReason(reason: string): string {
  const reasonMap: Record<string, string> = {
    account_not_received: 'Account Not Received',
    incorrect_account: 'Incorrect Account Details',
    account_banned: 'Account Banned/Suspended',
    seller_unresponsive: 'Seller Unresponsive',
    other: 'Other',
  }
  return reasonMap[reason] || reason
}
