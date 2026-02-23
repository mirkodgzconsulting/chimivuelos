-- Update Parcels (Encomiendas) Table adding payment details
ALTER TABLE public.parcels 
ADD COLUMN IF NOT EXISTS payment_details jsonb default '[]'::jsonb;
