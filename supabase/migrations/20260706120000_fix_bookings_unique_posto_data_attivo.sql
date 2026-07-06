-- The original constraint was a plain UNIQUE on (lido_id, fila, numero_ombrellone, data),
-- so any row (even cancelled/expired) permanently blocked new bookings for that spot/date.
-- Replace it with a partial unique index scoped to active statuses only.
alter table public.bookings drop constraint unique_posto_data_attivo;

create unique index unique_posto_data_attivo
  on public.bookings (lido_id, fila, numero_ombrellone, data)
  where status in ('pending', 'confirmed', 'manually_held');
