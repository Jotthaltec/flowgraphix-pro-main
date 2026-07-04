-- Add new columns to the companies table if they don't exist

ALTER TABLE companies ADD COLUMN IF NOT EXISTS ie text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS delivery_address text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS default_delivery_preference text;

-- The other columns (cnpj, phone, whatsapp, email, address) already exist based on the initial schema,
-- but let's add them conditionally just in case the initial schema was modified.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address text;
