-- Section 7: daily archiving + wiring up pg_cron (was not installed at all —
-- booking_cron_expire_pending/purge_season existed from the original
-- migration but were never scheduled, so pending bookings never actually
-- expired in production). Installing pg_cron now and scheduling all three
-- booking crons, isolated from the existing trial cron (none of these touch
-- ordini/trial tables).
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS archiviato boolean NOT NULL DEFAULT false;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;

CREATE OR REPLACE FUNCTION public.booking_cron_archive_daily()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE bookings SET archiviato = true
  WHERE data = current_date AND archiviato = false;
  RAISE LOG '[booking_cron] Daily archive completed';
END;
$$;

-- Archive today's bookings at 23:59 (server time, UTC on Supabase).
SELECT cron.schedule('booking-archive-daily', '59 23 * * *', 'SELECT public.booking_cron_archive_daily();');

-- Expire pending bookings past their check-in deadline, checked every 5 minutes.
SELECT cron.schedule('booking-expire-pending', '*/5 * * * *', 'SELECT public.booking_cron_expire_pending();');

-- Purge previous-season bookings once a day at low-traffic hours.
SELECT cron.schedule('booking-purge-season', '0 3 * * *', 'SELECT public.booking_cron_purge_season();');
