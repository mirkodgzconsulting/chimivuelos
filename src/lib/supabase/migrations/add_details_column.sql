-- Execute this SQL in your Supabase SQL Editor to add the details column to the flights table
ALTER TABLE flights ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
