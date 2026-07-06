-- RPC used by the public booking form (/lido/$slug/prenota). Mirrors the
-- create_ordine pattern: SECURITY DEFINER so the anon client can insert
-- without a broad INSERT policy, validates against the real beach_config
-- grid (both fila and numero_ombrellone, unlike create_ordine which only
-- checks numero), and creates one row per selected date sharing the same
-- booking_session_id.
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
 SET search_path TO 'public'
AS $function$
DECLARE
  v_module_enabled boolean;
  v_max_days int;
  v_expiry_time time;
  v_has_config boolean;
  v_session_id uuid := gen_random_uuid();
  v_slot jsonb;
  v_valido boolean;
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

  RETURN QUERY
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
  RETURNING *;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Uno o più ombrelloni selezionati non sono più disponibili per la data scelta'
      USING ERRCODE = 'unique_violation';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_booking(uuid, text, text, text, text, jsonb) TO anon, authenticated;

-- The public form needs to know which spots are already taken for a given
-- date, but bookings has no anon SELECT policy (customer PII lives there).
-- This exposes only fila/numero_ombrellone for active bookings on that date.
CREATE OR REPLACE FUNCTION public.get_booked_spots(_lido_id uuid, _data date)
 RETURNS TABLE(fila text, numero_ombrellone text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT b.fila, b.numero_ombrellone
  FROM public.bookings b
  WHERE b.lido_id = _lido_id
    AND b.data = _data
    AND b.status IN ('pending', 'confirmed', 'manually_held');
$function$;

GRANT EXECUTE ON FUNCTION public.get_booked_spots(uuid, date) TO anon, authenticated;
