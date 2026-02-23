-- Create edit_requests table
CREATE TABLE IF NOT EXISTS public.edit_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    resource_type text NOT NULL, -- 'flights', 'money_transfers', 'parcels'
    resource_id uuid NOT NULL,
    reason text NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    admin_id uuid REFERENCES public.profiles(id),
    approved_at timestamp WITH time zone,
    expires_at timestamp WITH time zone,
    created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action text NOT NULL, -- 'create', 'update', 'delete', 'approve_edit', 'reject_edit'
    resource_type text NOT NULL,
    resource_id text NOT NULL, -- ID or tracking code
    old_values jsonb,
    new_values jsonb,
    metadata jsonb,
    created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.edit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create Policies
-- Auth users can see and create requests
CREATE POLICY "Authenticated users can manage edit_requests" ON public.edit_requests
    FOR ALL USING (auth.role() = 'authenticated');

-- Auth users can see and create audit logs
CREATE POLICY "Authenticated users can manage audit_logs" ON public.audit_logs
    FOR ALL USING (auth.role() = 'authenticated');
