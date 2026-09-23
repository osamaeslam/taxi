-- Fix clients table columns for passenger directory
ALTER TABLE clients ADD COLUMN village TEXT DEFAULT 'العياط';
ALTER TABLE clients ADD COLUMN destination_fav TEXT DEFAULT 'جامعة القاهرة';
ALTER TABLE clients ADD COLUMN trips_count INTEGER DEFAULT 1;
