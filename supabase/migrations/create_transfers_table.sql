-- Tabla de Giros (Money Transfers)
create table if not exists public.money_transfers (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Relación con el Cliente (Quien envía)
  client_id uuid references public.profiles(id) not null,
  
  -- Detalles Económicos del Envío
  amount_sent decimal(10,2) not null,        -- Monto que se envía en EUR
  exchange_rate decimal(10,4) not null,      -- Tasa de cambio (ej. 4.10)
  amount_received decimal(10,2) not null,    -- Monto que llega en PEN (Calculado)
  commission decimal(10,2) default 0,        -- Comisión de la agencia en EUR
  
  -- Control de Pagos (En EUR)
  total_amount decimal(10,2) not null,       -- Total a cobrar (Envío + Comisión)
  on_account decimal(10,2) default 0,        -- Lo que pagó el cliente
  balance decimal(10,2) default 0,           -- Lo que debe el cliente
  
  -- Datos del Beneficiario (Quien recibe)
  beneficiary_name text not null,
  beneficiary_document text,                 -- DNI o Pasaporte
  beneficiary_phone text,
  beneficiary_bank text,                     -- Ej: BCP, Interbank
  beneficiary_account text,                  -- Nro Cuenta / CCI
  
  -- Estado y Código
  transfer_code text,                        -- Código de referencia del giro
  status text default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  
  -- Documentos adjuntos (Vouchers, etc.)
  -- Se manejará en una tabla aparte o storage bucket linkeado por ID, 
  -- similar a vuelos o en un array si es simple. Por consistencia con Vuelos, 
  -- usaremos la misma lógica de "FlightFiles" pero para "TransferFiles" o una tabla genérica.
  -- Por simplicidad inicial, podemos usar una columna JSONB o tabla relacionada.
  -- Asumiremos tabla relacionada 'transfer_files' similar a 'flight_files' si es necesario.
  doc_count integer default 0
);

-- Políticas RLS (Seguridad)
alter table public.money_transfers enable row level security;

create policy "Enable read access for authenticated users"
on public.money_transfers for select
to authenticated
using (true);

create policy "Enable insert for authenticated users"
on public.money_transfers for insert
to authenticated
with check (true);

create policy "Enable update for authenticated users"
on public.money_transfers for update
to authenticated
using (true);

create policy "Enable delete for authenticated users"
on public.money_transfers for delete
to authenticated
using (true);
