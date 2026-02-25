-- Create other_services table
CREATE TABLE IF NOT EXISTS public.other_services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tracking_code TEXT UNIQUE NOT NULL,
    client_id UUID REFERENCES public.profiles(id) NOT NULL,
    agent_id UUID REFERENCES public.profiles(id),
    service_type TEXT NOT NULL,
    service_type_other TEXT,
    note TEXT,
    documents JSONB DEFAULT '[]'::jsonb,
    total_amount NUMERIC(15, 2) DEFAULT 0,
    on_account NUMERIC(15, 2) DEFAULT 0,
    balance NUMERIC(15, 2) DEFAULT 0,
    payment_details JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'delivered', 'cancelled')),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.other_services ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins and Agents can view all other_services" ON public.other_services
    FOR SELECT USING (
        auth.jwt() ->> 'role' = 'service_role' OR 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'agent', 'usuario')
    );

CREATE POLICY "Clients can view own other_services" ON public.other_services
    FOR SELECT USING (auth.uid() = client_id);

CREATE POLICY "Admins and Agents can insert other_services" ON public.other_services
    FOR INSERT WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'agent', 'usuario')
    );

CREATE POLICY "Admins and Agents can update other_services" ON public.other_services
    FOR UPDATE USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'agent', 'usuario')
    );

CREATE POLICY "Admins can delete other_services" ON public.other_services
    FOR DELETE USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_other_services_updated_at
    BEFORE UPDATE ON public.other_services
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
