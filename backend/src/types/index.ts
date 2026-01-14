/**
 * Pure TypeScript type definitions - NO ORM/Drizzle
 * These are for type safety only - all queries use raw SQL
 */

// ==================== ENUMS ====================

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin'
}

export enum PostingStatus {
  ACTIVE = 'active',
  SOLD = 'sold',
  EXPIRED = 'expired',
  DELETED = 'deleted'
}

export enum LoginMethod {
  MOONTON = 'moonton',
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  VK = 'vk',
  APPLE = 'apple',
  EMAIL = 'email'
}

export enum TransactionStatus {
  PENDING = 'pending',
  PAID = 'paid',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  DISPUTED = 'disputed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  EXPIRED = 'expired'
}

export enum DisputeStatus {
  OPEN = 'open',
  INVESTIGATING = 'investigating',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export enum NotificationType {
  NEW_SALE = 'new_sale',
  PURCHASE_COMPLETE = 'purchase_complete',
  PAYMENT_RECEIVED = 'payment_received',
  POSTING_EXPIRED = 'posting_expired',
  DISPUTE_OPENED = 'dispute_opened',
  DISPUTE_RESOLVED = 'dispute_resolved',
  REVIEW_REQUESTED = 'review_requested',
  REVIEW_RECEIVED = 'review_received',
  REVIEW_REMINDER = 'review_reminder',
  TRUST_LEVEL_UPGRADED = 'trust_level_upgraded'
}

export enum TrustLevel {
  NEWBIE = 'newbie',
  TRUSTED = 'trusted',
  POWER = 'power'
}

// ==================== TYPE DEFINITIONS ====================

export interface User {
  id: string
  email: string
  google_id: string // Unique Google OAuth identifier
  google_name: string | null // User's name from Google
  google_avatar_url: string | null // User's avatar from Google
  username: string
  role: UserRole
  login_method: LoginMethod
  created_at: Date
  updated_at: Date
}

export interface UserProfile {
  user_id: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  bio: string | null
  city: string | null
  country: string | null
  created_at: Date
  updated_at: Date
}

export interface SellerStats {
  id: number
  user_id: number
  total_sales: number
  successful_transactions: number
  cancelled_transactions: number
  dispute_count: number
  average_rating: number | null
  trust_level: TrustLevel
  last_activity_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface Game {
  id: number
  name: string
  slug: string
  icon_url: string | null
  description: string | null
  is_active: boolean
  created_at: Date
}

export interface GameFieldDefinition {
  id: number
  game_id: number
  field_name: string
  field_label: string
  field_type: string
  field_options: Record<string, any> | null
  is_required: boolean
  display_order: number
  created_at: Date
}

export interface GameAccount {
  id: number
  seller_id: number
  game_id: number
  account_identifier: string
  status: PostingStatus
  price: number
  description: string | null
  field_values: Record<string, any> | null
  cover_image_url: string | null
  created_at: Date
  updated_at: Date
}

export interface Transaction {
  id: number
  buyer_id: number
  seller_id: number
  game_account_id: number
  item_price: number
  platform_fee_percentage: number
  platform_fee_amount: number
  disbursement_fee: number
  total_buyer_paid: number
  seller_received: number
  payment_method: string | null
  payment_gateway_ref: string | null
  payment_status: PaymentStatus
  status: TransactionStatus
  expires_at: Date | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface Dispute {
  id: string
  transaction_id: string
  raised_by: string
  reason: string
  status: DisputeStatus
  resolution: string | null
  resolved_at: Date | null
  created_at: Date
}

export interface Favorite {
  user_id: string
  game_account_id: string
  created_at: Date
}

export interface Review {
  id: string
  transaction_id: string
  reviewer_id: string
  reviewee_id: string
  rating: number
  comment: string | null
  is_edited: boolean
  edited_at: Date | null
  created_at: Date
}

export interface ReviewPhoto {
  id: string
  review_id: string
  photo_url: string
  file_size_kb: number | null
  uploaded_at: Date
}

export interface ReviewResponse {
  id: string
  review_id: string
  responder_id: string
  response_text: string
  created_at: Date
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  link: string | null
  is_read: boolean
  created_at: Date
}
