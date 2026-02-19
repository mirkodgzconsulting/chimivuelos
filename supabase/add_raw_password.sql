-- SCRIPT DE RESCATE: Restaura el acceso a los clientes y evita el bucle infinito
-- 1. Borrar políticas conflictivas
DROP POLICY IF EXISTS "Admins and agents can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Clients can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

-- 2. Restaurar acceso inicial (Esto hará que vuelvan a aparecer los clientes de inmediato)
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);

-- 3. Asegurar que la columna de contraseña existe
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS raw_password TEXT;
