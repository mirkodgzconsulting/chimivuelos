
-- Table to store requests for editing records
CREATE TABLE public.edit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.profiles(id) NOT NULL,
    resource_type TEXT NOT NULL, -- 'flights', 'money_transfers', 'parcels'
    resource_id UUID NOT NULL,
    reason TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    admin_id UUID REFERENCES public.profiles(id), -- Admin who approved/rejected
    approved_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ, -- Permission window
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.edit_requests ENABLE ROW LEVEL SECURITY;

-- Policies for edit_requests
CREATE POLICY "Agents can view their own requests." 
ON public.edit_requests FOR SELECT 
USING (auth.uid() = agent_id);

CREATE POLICY "Agents can insert their own requests." 
ON public.edit_requests FOR INSERT 
WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Admins can view all edit requests." 
ON public.edit_requests FOR SELECT 
USING (public.get_my_role() IN ('admin', 'supervisor'));

CREATE POLICY "Admins can update edit requests." 
ON public.edit_requests FOR UPDATE 
USING (public.get_my_role() IN ('admin', 'supervisor'));

-- Audit logs table for full traceability
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) NOT NULL,
    action TEXT NOT NULL, -- 'create', 'update', 'delete', 'approve_edit', 'reject_edit'
    resource_type TEXT NOT NULL,
    resource_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB, -- reason, ip, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs." 
ON public.audit_logs FOR SELECT 
USING (public.get_my_role() IN ('admin', 'supervisor'));
