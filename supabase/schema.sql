-- Create profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin', 'client')) DEFAULT 'client',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Create flights table
CREATE TABLE public.flights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.profiles(id) NOT NULL,
  airline TEXT NOT NULL,
  flight_code TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_date TIMESTAMPTZ NOT NULL,
  arrival_date TIMESTAMPTZ,
  status TEXT CHECK (status IN ('scheduled', 'delayed', 'cancelled', 'landed')) DEFAULT 'scheduled',
  ticket_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;

-- Flights policies
CREATE POLICY "Admins can view all flights." ON public.flights FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role' OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Clients can view own flights." ON public.flights FOR SELECT USING (auth.uid() = client_id);
-- Admins can insert/update/delete (omitted for brevity, assume admin tools use service_role or admin user)

-- Create money transfers table
CREATE TABLE public.money_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.profiles(id) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  recipient_name TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'completed', 'cancelled')) DEFAULT 'pending',
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.money_transfers ENABLE ROW LEVEL SECURITY;

-- Money transfers policies
CREATE POLICY "Admins can view all transfers." ON public.money_transfers FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role' OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Clients can view own transfers." ON public.money_transfers FOR SELECT USING (auth.uid() = client_id);


-- Create parcels table
CREATE TABLE public.parcels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.profiles(id) NOT NULL,
  tracking_number TEXT UNIQUE NOT NULL,
  description TEXT,
  weight_kg DECIMAL(5, 2),
  status TEXT CHECK (status IN ('pending', 'in_transit', 'delivered', 'returned')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;

-- Parcels policies
CREATE POLICY "Admins can view all parcels." ON public.parcels FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role' OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Clients can view own parcels." ON public.parcels FOR SELECT USING (auth.uid() = client_id);

-- Create tickets table
CREATE TABLE public.tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.profiles(id) NOT NULL,
  subject TEXT NOT NULL,
  status TEXT CHECK (status IN ('open', 'in_progress', 'resolved')) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Tickets policies
CREATE POLICY "Admins can view all tickets." ON public.tickets FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role' OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Clients can view own tickets." ON public.tickets FOR SELECT USING (auth.uid() = client_id);

-- Create ticket messages table
CREATE TABLE public.ticket_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.tickets(id) NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- Messages policies
CREATE POLICY "Admins can view all messages." ON public.ticket_messages FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role' OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Clients can view messages for own tickets." ON public.ticket_messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.tickets WHERE id = ticket_id AND client_id = auth.uid()));

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'client');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call handle_new_user on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
