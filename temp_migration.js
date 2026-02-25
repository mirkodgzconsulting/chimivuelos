
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const sql = `
    CREATE TABLE IF NOT EXISTS public.translations (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        tracking_code TEXT UNIQUE,
        client_id UUID REFERENCES public.profiles(id) NOT NULL,
        agent_id UUID REFERENCES public.profiles(id),
        document_types JSONB DEFAULT '[]'::jsonb,
        document_types_other TEXT,
        quantity INTEGER DEFAULT 1,
        documents JSONB DEFAULT '[]'::jsonb,
        work_types JSONB DEFAULT '[]'::jsonb,
        work_types_other TEXT,
        origin_address TEXT,
        destination_address TEXT,
        destination_address_client TEXT,
        net_amount DECIMAL(10, 2) DEFAULT 0,
        total_amount DECIMAL(10, 2) DEFAULT 0,
        on_account DECIMAL(10, 2) DEFAULT 0,
        balance DECIMAL(10, 2) DEFAULT 0,
        payment_details JSONB DEFAULT '[]'::jsonb,
        status TEXT DEFAULT 'pending'
    );
    ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
    
    -- Basic policies (following the pattern in schema.sql)
    DO $$ 
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'translations' AND policyname = 'Admins can view all translations.') THEN
            CREATE POLICY "Admins can view all translations." ON public.translations FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role' OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'translations' AND policyname = 'Clients can view own translations.') THEN
            CREATE POLICY "Clients can view own translations." ON public.translations FOR SELECT USING (auth.uid() = client_id);
        END IF;
    END $$;
    `;
    
    // Check if exec_sql rpc exists
    const { error: rpcError } = await supabaseAdmin.rpc('exec_sql', { sql });
    if (rpcError) {
        console.error('RPC Error:', rpcError.message);
        console.log('You may need to create the exec_sql function or create the table manually in Supabase Dashboard.');
    } else {
        console.log('Success: Table translations handled.');
    }
}

run();
