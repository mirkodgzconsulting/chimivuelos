-- Create Parcels (Encomiendas) Table
create table if not exists public.parcels (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Tracking
  tracking_code text unique, -- Generado como ENC-1234
  
  -- Sender (Cliente Registrado)
  sender_id uuid references public.profiles(id) on delete set null,
  
  -- Recipient (Destinatario)
  recipient_name text not null,
  recipient_document text,
  recipient_phone text,
  recipient_address text not null, -- Importante para encomiendas
  
  -- Package Details (Simplificado)
  package_type text, -- Sobre, Caja, Maleta, Paquete, Otros
  package_description text, -- Descripción general del contenido
  package_weight text, -- Peso genérico (ej. "5kg" o "Liviano") - Texto para máxima flexibilidad
  
  -- Economics (Simplificado: Sin precio x kg)
  shipping_cost decimal(10,2) default 0, -- Costo Total del Envío
  on_account decimal(10,2) default 0,    -- A Cuenta
  balance decimal(10,2) generated always as (shipping_cost - on_account) stored, -- Saldo Automático
  
  -- Status & Docs
  status text default 'pending', -- pending, warehouse, transit, delivered, cancelled
  documents jsonb[] default array[]::jsonb[], -- Fotos del paquete / Guía
  
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS Policies
alter table public.parcels enable row level security;

create policy "Enable read access for all users" on public.parcels for select using (true);
create policy "Enable insert for authenticated users only" on public.parcels for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users only" on public.parcels for update using (auth.role() = 'authenticated');
create policy "Enable delete for authenticated users only" on public.parcels for delete using (auth.role() = 'authenticated');
