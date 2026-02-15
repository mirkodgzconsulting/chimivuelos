-- Gestión de Términos y Condiciones (Auditabilidad Legal)

-- 1. Tabla de Versiones de Documentos
-- Permite tener "Vuelos v1.0", "Vuelos v2.0" y saber cuál aceptó el cliente.
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_type TEXT NOT NULL CHECK (service_type IN ('flight', 'parcel', 'transfer')),
  version TEXT NOT NULL,
  content TEXT NOT NULL, -- Contenido HTML/Markdown
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_type, version)
);

-- Index for fast lookup of active terms
CREATE INDEX IF NOT EXISTS idx_legal_docs_active ON public.legal_documents(service_type, is_active);

-- 2. Modificación de Tablas de Servicios (Para Auditoría)
-- Se agregan campos a cada servicio para "congelar" la aceptación en el tiempo.

-- VUELOS
ALTER TABLE public.flights 
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS terms_version TEXT,
ADD COLUMN IF NOT EXISTS terms_ip TEXT,
ADD COLUMN IF NOT EXISTS terms_metadata JSONB; -- Para User-Agent, Device, etc.

COMMENT ON COLUMN public.flights.terms_accepted_at IS 'Fecha y hora exacta en que el cliente aceptó los términos para este vuelo específico.';

-- ENCOMIENDAS (Parcels)
ALTER TABLE public.parcels 
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS terms_version TEXT,
ADD COLUMN IF NOT EXISTS terms_ip TEXT,
ADD COLUMN IF NOT EXISTS terms_metadata JSONB;

-- GIROS (Money Transfers)
ALTER TABLE public.money_transfers
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS terms_version TEXT,
ADD COLUMN IF NOT EXISTS terms_ip TEXT,
ADD COLUMN IF NOT EXISTS terms_metadata JSONB;

-- 3. Datos Semilla (Ejemplos iniciales)
INSERT INTO public.legal_documents (service_type, version, content, is_active)
VALUES 
('flight', '1.0', '<h1>Términos y Condiciones de Vuelos</h1><p>Al adquirir este servicio de vuelo, usted acepta las condiciones de tarifas, equipaje y cancelaciones...</p>', true),
('parcel', '1.0', '<h1>Términos y Condiciones de Encomiendas</h1><p>El traslado de paquetes está sujeto a inspección y restricciones aduaneras...</p>', true),
('transfer', '1.0', '<h1>Términos y Condiciones de Giros</h1><p>Las transferencias de dinero se procesan según la normativa financiera vigente...</p>', true)
ON CONFLICT (service_type, version) DO NOTHING;
