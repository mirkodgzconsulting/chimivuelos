-- Add Terms & Conditions tracking columns to flights table
ALTER TABLE flights ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE flights ADD COLUMN IF NOT EXISTS terms_version TEXT;
ALTER TABLE flights ADD COLUMN IF NOT EXISTS terms_ip TEXT;
ALTER TABLE flights ADD COLUMN IF NOT EXISTS terms_metadata JSONB DEFAULT '{}'::jsonb;

-- Ensure RLS allows the client to update these specific fields OR use a function.
-- Since we use supabaseAdmin in the server action, RLS on update is bypassed for the admin client, 
-- but we must ensure the action validates ownership (which it does).
