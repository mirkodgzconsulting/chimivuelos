
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

-- Helper function to avoid recursion (Security Definer bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for Agents
CREATE POLICY "Agents can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Admins and Supervisors can manage agents
CREATE POLICY "Admins and supervisors can view all profiles." ON public.profiles FOR SELECT USING (
  auth.jwt() ->> 'role' = 'service_role' 
  OR public.get_my_role() IN ('admin', 'supervisor')
);
