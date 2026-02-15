-- Create type for flight status
DO $$ BEGIN
    CREATE TYPE flight_status AS ENUM ('pending', 'finished');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create flights table
CREATE TABLE IF NOT EXISTS public.flights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  travel_date date NOT NULL,
  pnr text,
  itinerary text,
  cost decimal(10,2) DEFAULT 0,
  on_account decimal(10,2) DEFAULT 0,
  balance decimal(10,2) DEFAULT 0,
  status text NOT NULL CHECK (status IN ('pending', 'finished')) DEFAULT 'pending',
  documents jsonb DEFAULT '[]'::jsonb, -- Stores array of { title, name, path, storage, size, type }
  created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;

-- Create Policies (Allow all authenticated users to full access)
CREATE POLICY "Enable all access for authenticated users" ON public.flights
  FOR ALL USING (auth.role() = 'authenticated');
