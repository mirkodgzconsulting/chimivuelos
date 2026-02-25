-- Actualizar los estados permitidos en la tabla de Giros (money_transfers)
ALTER TABLE public.money_transfers DROP CONSTRAINT IF EXISTS money_transfers_status_check;

ALTER TABLE public.money_transfers ADD CONSTRAINT money_transfers_status_check 
CHECK (status IN ('pending', 'processing', 'available', 'completed', 'cancelled'));

-- Comentario:
-- pending: Recibido por la agencia
-- processing: Enviado al banco/corresponsal
-- available: Listo para cobro en destino
-- completed: Cobrado/Depositado
-- cancelled: Cancelado
