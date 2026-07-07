-- Notifiche email del modulo prenotazioni (Edge Function send-booking-email),
-- via pg_net: fire-and-forget, non deve mai bloccare o far fallire la
-- creazione/scadenza di una prenotazione. Stesso pattern di
-- notify_contatto_insert (20260701160000).
--
-- NOTA: booking_cron_expire_pending e set_booking_expiry esistevano già solo
-- nel DB live (mai tracciate come migration): questa migration le sostituisce
-- con CREATE OR REPLACE per aggiungere il trigger email, senza cambiarne il
-- comportamento base.

create extension if not exists pg_net with schema extensions;

-- Segreto condiviso tra Postgres (chiamante) e la Edge Function
-- send-booking-email, verificato via header x-webhook-secret. Il valore reale
-- va copiato manualmente nei secrets della Edge Function dopo il deploy
-- (vedi istruzioni in fondo).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'booking_email_webhook_secret') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'booking_email_webhook_secret');
  end if;
end $$;

-- 1. Conferma cliente + notifica gestore alla creazione di una prenotazione.
-- create_booking inserisce una riga per ogni data/slot selezionato in
-- un'unica INSERT ... SELECT: catturiamo le righe inserite in un array per
-- poterle sia restituire (contratto invariato) sia scorrere per l'invio email.
CREATE OR REPLACE FUNCTION public.create_booking(
  _lido_id uuid,
  _nome text,
  _cognome text,
  _email text,
  _telefono text,
  _slots jsonb -- [{"fila": "Fila A", "numero_ombrellone": "3", "data": "2026-07-10"}, ...]
)
 RETURNS SETOF public.bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'vault'
AS $function$
DECLARE
  v_module_enabled boolean;
  v_max_days int;
  v_expiry_time time;
  v_has_config boolean;
  v_session_id uuid := gen_random_uuid();
  v_slot jsonb;
  v_valido boolean;
  v_rows public.bookings[];
  v_row public.bookings;
  v_webhook_secret text;
BEGIN
  SELECT booking_module_enabled, max_booking_days_ahead, booking_expiry_time
    INTO v_module_enabled, v_max_days, v_expiry_time
  FROM public.lidi WHERE id = _lido_id;

  IF NOT FOUND OR NOT v_module_enabled THEN
    RAISE EXCEPTION 'Prenotazioni non disponibili per questo stabilimento'
      USING ERRCODE = 'check_violation';
  END IF;

  IF _slots IS NULL OR jsonb_array_length(_slots) = 0 THEN
    RAISE EXCEPTION 'Nessuna data/ombrellone selezionato'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.beach_config WHERE lido_id = _lido_id) INTO v_has_config;

  FOR v_slot IN SELECT * FROM jsonb_array_elements(_slots)
  LOOP
    IF (v_slot->>'data')::date < CURRENT_DATE OR (v_slot->>'data')::date > CURRENT_DATE + v_max_days THEN
      RAISE EXCEPTION 'Data % non valida (max % giorni da oggi)', v_slot->>'data', v_max_days
        USING ERRCODE = 'check_violation';
    END IF;

    IF v_has_config THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.beach_config bc,
             jsonb_array_elements(bc.file) AS fila_json,
             jsonb_array_elements(fila_json->'ombrelloni') AS omb
        WHERE bc.lido_id = _lido_id
          AND fila_json->>'label' = v_slot->>'fila'
          AND (omb->>'numero')::int = (v_slot->>'numero_ombrellone')::int
      ) INTO v_valido;

      IF NOT v_valido THEN
        RAISE EXCEPTION 'Ombrellone % (%) non valido per questo stabilimento', v_slot->>'numero_ombrellone', v_slot->>'fila'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END LOOP;

  WITH inserted AS (
    INSERT INTO public.bookings (lido_id, fila, numero_ombrellone, nome, cognome, email, telefono, data, status, booking_session_id, expires_at)
    SELECT
      _lido_id,
      s->>'fila',
      s->>'numero_ombrellone',
      _nome, _cognome, _email, _telefono,
      (s->>'data')::date,
      'pending',
      v_session_id,
      ((s->>'data')::date + v_expiry_time) AT TIME ZONE 'Europe/Rome'
    FROM jsonb_array_elements(_slots) AS s
    RETURNING *
  )
  SELECT array_agg(inserted::public.bookings) INTO v_rows FROM inserted;

  -- Invio email fire-and-forget: un eventuale errore qui (vault, rete,
  -- extension mancante) non deve mai far fallire la prenotazione appena creata.
  BEGIN
    SELECT decrypted_secret INTO v_webhook_secret
    FROM vault.decrypted_secrets
    WHERE name = 'booking_email_webhook_secret';

    IF v_webhook_secret IS NOT NULL THEN
      FOREACH v_row IN ARRAY v_rows
      LOOP
        PERFORM net.http_post(
          url := 'https://vkpckptflbhueseszvqp.supabase.co/functions/v1/send-booking-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', v_webhook_secret
          ),
          body := jsonb_build_object(
            'booking_id', v_row.id,
            'event_type', 'created'
          )
        );
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY SELECT * FROM unnest(v_rows);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Uno o più ombrelloni selezionati non sono più disponibili per la data scelta'
      USING ERRCODE = 'unique_violation';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_booking(uuid, text, text, text, text, jsonb) TO anon, authenticated;

-- 2. Avviso scadenza al cliente quando il cron marca una prenotazione come
-- expired (solo se ha un'email, per coerenza col resto del modulo anche se
-- bookings.email è oggi NOT NULL).
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
    WHERE status = 'pending' AND expires_at < now()
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
