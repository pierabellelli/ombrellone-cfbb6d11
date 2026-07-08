-- set_booking_expiry esisteva solo nel DB live, mai tracciata in una
-- migration (stesso tipo di schema-drift già riscontrato per user_lido_id()).
-- Questa migration la cattura e ne corregge due bug:
--
-- 1. Timezone: il cast (NEW.data + v_expiry_time)::timestamptz non
--    specificava il fuso orario, quindi veniva interpretato con il timezone
--    di sessione (UTC). Un cutoff configurato "10:00" finiva salvato come
--    10:00 UTC (mezzogiorno ora italiana estiva) invece delle 10:00 locali.
--
-- 2. Prenotazioni "same-day oltre il cutoff": se un cliente prenota oggi ma
--    dopo l'orario di cutoff del lido, la prenotazione nasceva con
--    expires_at già nel passato, e il cron booking_cron_expire_pending la
--    marcava "expired" entro 5 minuti anche se il cliente aveva appena
--    prenotato. Ora, in questo caso, expires_at diventa NULL: la
--    prenotazione resta "pending" ("immediata") finché lo staff non fa
--    check-in a mano, senza rischio di auto-scadenza.
--
-- create_booking (in 20260707180000_booking_email_notifications.sql) non va
-- modificata: il suo calcolo di expires_at nell'INSERT viene comunque
-- sempre sovrascritto da questo trigger BEFORE INSERT.

CREATE OR REPLACE FUNCTION public.set_booking_expiry()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_expiry_time time;
  v_now_rome timestamp;
BEGIN
  SELECT booking_expiry_time INTO v_expiry_time FROM lidi WHERE id = NEW.lido_id;
  v_expiry_time := COALESCE(v_expiry_time, '10:00'::time);

  v_now_rome := now() AT TIME ZONE 'Europe/Rome';

  IF NEW.data = v_now_rome::date AND v_now_rome > (NEW.data + v_expiry_time) THEN
    NEW.expires_at := NULL;
  ELSE
    NEW.expires_at := (NEW.data + v_expiry_time) AT TIME ZONE 'Europe/Rome';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- Difensivo/esplicito: NULL < now() è già falso in SQL, ma rendiamo la
-- condizione leggibile. Nessun altro cambiamento (invio email invariato).
CREATE OR REPLACE FUNCTION public.booking_cron_expire_pending()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'vault'
AS $$
DECLARE
  v_rows record;
  v_webhook_secret text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_webhook_secret
    FROM vault.decrypted_secrets
    WHERE name = 'booking_email_webhook_secret';
  EXCEPTION WHEN OTHERS THEN
    v_webhook_secret := NULL;
  END;

  FOR v_rows IN
    UPDATE bookings SET status = 'expired'
    WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < now()
    RETURNING id, email
  LOOP
    IF v_webhook_secret IS NOT NULL AND v_rows.email IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url := 'https://vkpckptflbhueseszvqp.supabase.co/functions/v1/send-booking-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', v_webhook_secret
          ),
          body := jsonb_build_object(
            'booking_id', v_rows.id,
            'event_type', 'expired'
          )
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END LOOP;

  RAISE LOG '[booking_cron] Expire check completed';
END;
$$;
