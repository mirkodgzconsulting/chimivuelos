-- Ejecutar este script en el editor SQL de Supabase para agregar los nuevos campos de logística a la tabla other_services

ALTER TABLE public.other_services ADD COLUMN IF NOT EXISTS recipient_name TEXT;
ALTER TABLE public.other_services ADD COLUMN IF NOT EXISTS recipient_phone TEXT;
ALTER TABLE public.other_services ADD COLUMN IF NOT EXISTS origin_address TEXT;
ALTER TABLE public.other_services ADD COLUMN IF NOT EXISTS destination_address TEXT;
ALTER TABLE public.other_services ADD COLUMN IF NOT EXISTS destination_address_client TEXT;
