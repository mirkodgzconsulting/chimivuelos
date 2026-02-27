-- ========================================================
-- SCRIPT DE RESTAURACIÓN TOTAL (RESET DE POLÍTICAS)
-- ========================================================
-- Este script borra TODAS las políticas de seguridad para detener
-- el error de recursión infinita y restaura el acceso básico.

-- 1. ELIMINAR TODAS LAS POLÍTICAS EXISTENTES (Limpieza Total)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 2. ASEGURAR QUE LOS ROLES SON CORRECTOS
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'supervisor', 'agent', 'client', 'usuario', 'agente', 'superadmin'));

-- 3. RESTAURAR ACCESO DE LECTURA (SIN RECURSIÓN)
-- La regla más simple: los usuarios autenticados pueden VER los datos.
-- Esto ELIMINA el bucle infinito porque no hace sub-consultas.

-- Perfiles (Clientes y Agentes)
CREATE POLICY "read_all_profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
-- Conversaciones y Mensajes
CREATE POLICY "read_all_conversations" ON public.conversations FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_all_messages" ON public.messages FOR SELECT TO authenticated USING (true);
-- Operaciones
CREATE POLICY "read_all_flights" ON public.flights FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_all_transfers" ON public.money_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_all_parcels" ON public.parcels FOR SELECT TO authenticated USING (true);

-- 4. PERMITIR OPERACIONES BÁSICAS (INSERT/UPDATE)
-- Inserción de perfiles (para registro)
CREATE POLICY "insert_profiles" ON public.profiles FOR INSERT WITH CHECK (true);
-- Actualización de perfil propio
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Mensajes y Conversaciones
CREATE POLICY "manage_conversations" ON public.conversations FOR ALL USING (true);
CREATE POLICY "manage_messages" ON public.messages FOR ALL USING (true);

-- 5. HABILITAR RLS (Por si acaso se deshabilitó)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.money_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;

-- FIN DEL SCRIPT. REFRESCAR EL NAVEGADOR.
