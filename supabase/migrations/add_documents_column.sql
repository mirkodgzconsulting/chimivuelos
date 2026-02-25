alter table public.money_transfers 
add column if not exists documents jsonb default '[]'::jsonb;
