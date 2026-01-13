-- Add missing transaction fee columns (if they don't exist)

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'item_price'
  ) THEN
    ALTER TABLE transactions ADD COLUMN item_price NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE transactions ADD COLUMN platform_fee_percentage NUMERIC(5,2) DEFAULT 0;
    ALTER TABLE transactions ADD COLUMN platform_fee_amount NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE transactions ADD COLUMN disbursement_fee NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE transactions ADD COLUMN total_buyer_paid NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE transactions ADD COLUMN seller_received NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE transactions ADD COLUMN payment_gateway_ref VARCHAR(255);
  END IF;
END $$;

-->

-- Update existing transactions to use item_price instead of amount
UPDATE transactions SET item_price = amount WHERE item_price = 0 AND amount > 0;

-->

-- Make amount column nullable (old column, no longer used)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'amount' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE transactions ALTER COLUMN amount DROP NOT NULL;
  END IF;
END $$;
