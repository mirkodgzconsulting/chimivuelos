-- Optimización para Realtime en el sistema de chat
-- REPLICA IDENTITY FULL asegura que todos los campos estén presentes en los eventos
-- de actualización y borrado, y mejora la consistencia del WAL para las suscripciones.

ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Asegurar que la publicación incluye todas las operaciones necesarias
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE public.conversations, public.messages;
