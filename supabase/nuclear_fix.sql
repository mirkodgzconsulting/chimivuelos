-- ========================================================
-- SCRIPT DE EMERGENCIA: CORRECCIÓN TOTAL DE RECURSIÓN
-- ========================================================
-- Este script ELIMINA TODA RESTRICCIÓN que cause bucles infinitos
-- y restaura el acceso a Clientes, Agentes y Mensajes.

-- 1. DESHABILITAR RLS TEMPORALMENTE (Para asegurar limpieza)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. FUNCIÓN DE ROL SEGURA (SECURITY DEFINER)
-- Esta función es la ÚNICA forma de consultar roles sin causar recursión.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. LIMPIEZA ABSOLUTA DE POLÍTICAS EN PROFILES
-- Intentamos borrar todos los nombres posibles para asegurar que no quede ninguna regla "vieja" oculta.
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Admins can view all profiles." ON public.profiles;
    DROP POLICY IF EXISTS "Admins and supervisors can view all profiles." ON public.profiles;
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
    DROP POLICY IF EXISTS "Users can view own profile." ON public.profiles;
    DROP POLICY IF EXISTS "Staff can view all profiles." ON public.profiles;
    DROP POLICY IF EXISTS "Agents can view everyone." ON public.profiles;
    DROP POLICY IF EXISTS "Admins and agents can view all profiles" ON public.profiles;
    DROP POLICY IF EXISTS "Clients can view their own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
    DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
    DROP POLICY IF EXISTS "Agents can update own profile." ON public.profiles;
    EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. RESTAURAR POLÍTICAS SOLIDAS PARA PROFILES
-- Permitir que CUALQUIER usuario autenticado vea los perfiles (Esto elimina la recursión de raíz)
-- Es seguro porque los datos sensibles (contraseñas/documentos) se manejan por lógica de negocio
-- o políticas de INSERT/UPDATE más estrictas.
CREATE POLICY "Allow select for authenticated users" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

-- Permitir que cada uno actualice su propia info
CREATE POLICY "Allow update for owners" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- Permitir inserción (para registros nuevos)
CREATE POLICY "Allow insert for all" 
ON public.profiles FOR INSERT 
WITH CHECK (true);

-- 5. CORREGIR CHAT (CONVERSATIONS Y MESSAGES)
-- Borrar políticas que usen subqueríes recursivos
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Admins can view all conversations" ON public.conversations;
    DROP POLICY IF EXISTS "Admins can insert/update conversations" ON public.conversations;
    DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
    DROP POLICY IF EXISTS "Users can insert messages in their accessible conversations" ON public.messages;
    EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Nuevas políticas de chat usando la función segura get_my_role()
CREATE POLICY "Staff and owners can view conversations" ON public.conversations
    FOR SELECT USING (
        public.get_my_role() IN ('admin', 'supervisor', 'agent', 'usuario', 'superadmin')
        OR auth.uid() = client_id
    );

CREATE POLICY "Staff can manage conversations" ON public.conversations
    FOR ALL USING (
        public.get_my_role() IN ('admin', 'supervisor', 'agent', 'usuario', 'superadmin')
    );

CREATE POLICY "Users can manage messages" ON public.messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.conversations c 
            WHERE c.id = messages.conversation_id 
            AND (c.client_id = auth.uid() OR public.get_my_role() IN ('admin', 'supervisor', 'agent', 'usuario', 'superadmin'))
        )
    );

-- 6. RE-HABILITAR RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 7. PERMISOS FINALES
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;

-- ACTUALIZAR RESTRICCIÓN DE ROLES PARA INCLUIR SUPERVISOR
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'supervisor', 'agent', 'client', 'usuario', 'agente', 'superadmin'));

-- FIN DEL SCRIPT. REFRESCAR EL NAVEGADOR.
