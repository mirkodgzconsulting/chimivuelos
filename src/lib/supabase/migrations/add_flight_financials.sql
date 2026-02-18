-- Add new columns for flight registration
ALTER TABLE flights ADD COLUMN IF NOT EXISTS return_date DATE;
ALTER TABLE flights ADD COLUMN IF NOT EXISTS sold_price DECIMAL(10,2) DEFAULT 0; -- Precio Vendido
ALTER TABLE flights ADD COLUMN IF NOT EXISTS fee_agv DECIMAL(10,2) DEFAULT 0; -- Ganancia Agencia
ALTER TABLE flights ADD COLUMN IF NOT EXISTS payment_method_it TEXT; -- Metodo Pago Italia
ALTER TABLE flights ADD COLUMN IF NOT EXISTS payment_method_pe TEXT; -- Metodo Pago Peru
