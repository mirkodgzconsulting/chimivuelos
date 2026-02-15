-- Add columns for clients in profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS document_type TEXT,
ADD COLUMN IF NOT EXISTS document_number TEXT,
ADD COLUMN IF NOT EXISTS client_files JSONB DEFAULT '[]'::jsonb;

-- Ensure 'client' role is supported (already done in agents_update.sql but good to double check constraint)
-- ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'agent', 'client'));

-- Create storage bucket for client documents if it doesn't exist
-- Note: Bucket creation is usually done via dashboard, but here is the policy logic assume bucket 'client-documents' exists.
-- You need to create a bucket named 'client-documents' in your Supabase Storage dashboard and make it private (not public).

-- Policies for Client Documents Bucket
-- Allow authenticated users to upload (agents/admins mostly)
-- CREATE POLICY "Allow authenticated uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'client-documents' );
-- Allow users to view their own files? Or admins/agents to view all?
-- CREATE POLICY "Allow admins/agents to view all" ON storage.objects FOR SELECT TO authenticated USING ( bucket_id = 'client-documents' );
