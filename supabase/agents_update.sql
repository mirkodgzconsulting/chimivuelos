
-- Update profiles table to include new fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update role check constraint to include 'agent'
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'agent', 'client'));

-- Policies for Agents
CREATE POLICY "Agents can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Admins can manage agents (insert/update/delete handled via service role mostly, but let's allow read)
CREATE POLICY "Admins can view all profiles." ON public.profiles FOR SELECT USING (
  auth.jwt() ->> 'role' = 'service_role' 
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
