-- Script para corregir errores de aceptación de términos
-- Ejecuta este script en el SQL Editor de Supabase

-- 1. Tabla de Documentos Legales (si no existe)
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_type TEXT NOT NULL CHECK (service_type IN ('flight', 'parcel', 'transfer')),
  version TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_type, version)
);

-- Index para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_legal_docs_active ON public.legal_documents(service_type, is_active);

-- 2. Asegurar que las columnas existan en TODAS las tablas

-- VUELOS
ALTER TABLE public.flights ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE public.flights ADD COLUMN IF NOT EXISTS terms_version TEXT;
ALTER TABLE public.flights ADD COLUMN IF NOT EXISTS terms_ip TEXT;
ALTER TABLE public.flights ADD COLUMN IF NOT EXISTS terms_metadata JSONB;

-- ENCOMIENDAS (Parcels)
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS terms_version TEXT;
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS terms_ip TEXT;
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS terms_metadata JSONB;

-- GIROS (Money Transfers)
ALTER TABLE public.money_transfers ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE public.money_transfers ADD COLUMN IF NOT EXISTS terms_version TEXT;
ALTER TABLE public.money_transfers ADD COLUMN IF NOT EXISTS terms_ip TEXT;
ALTER TABLE public.money_transfers ADD COLUMN IF NOT EXISTS terms_metadata JSONB;

-- 3. Datos de prueba (si no existen)
INSERT INTO public.legal_documents (service_type, version, content, is_active)
VALUES 
('flight', '1.0', '<h1>Términos y Condiciones de Vuelos</h1><p>Al adquirir este servicio de vuelo, usted acepta las condiciones de tarifas, equipaje y cancelaciones...</p>', true),
('parcel', '1.0', '<h1>Términos y Condiciones de Encomiendas</h1><p>El traslado de paquetes está sujeto a inspección y restricciones aduaneras...</p>', true),
('transfer', '1.0', '<h1>Términos y Condiciones de Giros</h1><p>Las transferencias de dinero se procesan según la normativa financiera vigente...</p>', true)
ON CONFLICT (service_type, version) DO NOTHING;
