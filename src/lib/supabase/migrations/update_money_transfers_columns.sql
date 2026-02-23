-- Execute this SQL in your Supabase SQL Editor to update the money_transfers table
ALTER TABLE money_transfers ADD COLUMN IF NOT EXISTS payment_details JSONB DEFAULT '[]'::jsonb;
ALTER TABLE money_transfers ADD COLUMN IF NOT EXISTS expense_details JSONB DEFAULT '[]'::jsonb;
ALTER TABLE money_transfers ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES auth.users(id);

-- Optional: Update existing transfers with empty arrays if needed
UPDATE money_transfers SET payment_details = '[]'::jsonb WHERE payment_details IS NULL;
UPDATE money_transfers SET expense_details = '[]'::jsonb WHERE expense_details IS NULL;
