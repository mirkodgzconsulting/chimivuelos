-- ==========================================
-- ULTIMATE FIX FOR INFINITE RECURSION
-- ==========================================
-- This script fixes the lockout caused by recursive RLS policies on the 'profiles' table.
-- It also ensures the 'supervisor' role is correctly supported.

-- 1. FIX ROLE CONSTRAINT
-- Ensure all roles are allowed in the profiles table
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'supervisor', 'agent', 'client', 'usuario'));

-- 2. CREATE SECURITY DEFINER HELPER FUNCTION
-- SECURITY DEFINER allows the function to run with owner privileges, bypassing RLS.
-- This is the standard way to fix recursion in Supabase/PostgreSQL.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
DECLARE
    user_role text;
BEGIN
    SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. DROP ALL SELECT POLICIES ON PROFILES TO START FRESH
DROP POLICY IF EXISTS "Admins can view all profiles." ON public.profiles;
DROP POLICY IF EXISTS "Admins and supervisors can view all profiles." ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile." ON public.profiles;
DROP POLICY IF EXISTS "Agents can view everyone." ON public.profiles;

-- 4. CREATE NEW CLEAN POLICIES FOR PROFILES
-- Non-recursive policy using auth.uid() directly for self-view
CREATE POLICY "Users can view own profile." 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

-- Non-recursive policy using SECURITY DEFINER function for staff view
CREATE POLICY "Staff can view all profiles." 
ON public.profiles FOR SELECT 
USING (
    auth.jwt() ->> 'role' = 'service_role' 
    OR public.get_my_role() IN ('admin', 'supervisor', 'agent', 'usuario')
);

-- 5. APPLY THE FIX TO OTHER SENSITIVE TABLES (Consistency)

-- Flights
DROP POLICY IF EXISTS "Admins can view all flights." ON public.flights;
DROP POLICY IF EXISTS "Admins and supervisors can view all flights." ON public.flights;
CREATE POLICY "Staff can view all flights." 
ON public.flights FOR SELECT 
USING (auth.jwt() ->> 'role' = 'service_role' OR public.get_my_role() IN ('admin', 'supervisor', 'agent', 'usuario'));

-- Transfers
DROP POLICY IF EXISTS "Admins can view all transfers." ON public.money_transfers;
DROP POLICY IF EXISTS "Admins and supervisors can view all transfers." ON public.money_transfers;
CREATE POLICY "Staff can view all transfers." 
ON public.money_transfers FOR SELECT 
USING (auth.jwt() ->> 'role' = 'service_role' OR public.get_my_role() IN ('admin', 'supervisor', 'agent', 'usuario'));

-- Audit & Requests
DROP POLICY IF EXISTS "Admins can view all audit logs." ON public.audit_logs;
CREATE POLICY "Admins and supervisors can view audit logs." 
ON public.audit_logs FOR SELECT 
USING (public.get_my_role() IN ('admin', 'supervisor'));

DROP POLICY IF EXISTS "Admins can view all edit requests." ON public.edit_requests;
CREATE POLICY "Admins and supervisors can view edit requests." 
ON public.edit_requests FOR SELECT 
USING (public.get_my_role() IN ('admin', 'supervisor'));

-- 6. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;

-- SYSTEM SHOULD BE RESTORED IMMEDIATELY AFTER RUNNING THIS.
