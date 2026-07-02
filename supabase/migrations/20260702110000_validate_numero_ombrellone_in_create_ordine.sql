-- Impedisce ai clienti di inserire un numero ombrellone inesistente (es. 99 su un
-- lido che ne ha solo 30): create_ordine ora verifica il numero contro la griglia
-- reale configurata in beach_config.file per quel lido, prima di creare l'ordine.
-- Se il lido non ha ancora configurato la griglia (nessuna riga in beach_config),
-- il controllo viene saltato per non bloccare gli ordini di stabilimenti non ancora
-- configurati.
CREATE OR REPLACE FUNCTION public.create_ordine(
  _lido_id uuid,
  _numero_ombrellone text,
  _cognome text,
  _telefono text,
  _totale numeric,
  _note text,
  _metodo_pagamento text,
  _items jsonb
)
 RETURNS TABLE(id uuid, numero_ordine integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_numero int;
  v_has_config boolean;
  v_valido boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.beach_config WHERE lido_id = _lido_id) INTO v_has_config;

  IF v_has_config THEN
    IF _numero_ombrellone !~ '^[0-9]+$' THEN
      v_valido := false;
    ELSE
      SELECT EXISTS (
        SELECT 1
        FROM public.beach_config bc,
             jsonb_array_elements(bc.file) AS fila,
             jsonb_array_elements(fila->'ombrelloni') AS omb
        WHERE bc.lido_id = _lido_id
          AND (omb->>'numero')::int = _numero_ombrellone::int
      ) INTO v_valido;
    END IF;

    IF NOT v_valido THEN
      RAISE EXCEPTION 'Numero ombrellone non valido per questo stabilimento'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  INSERT INTO public.ordini (lido_id, numero_ombrellone, cognome, telefono, totale, note, metodo_pagamento, numero_ordine)
  VALUES (_lido_id, _numero_ombrellone, _cognome, _telefono, _totale, _note, _metodo_pagamento, 0)
  RETURNING ordini.id, ordini.numero_ordine INTO v_id, v_numero;

  INSERT INTO public.ordine_items (ordine_id, prodotto_id, nome_snapshot, prezzo_snapshot, quantita)
  SELECT v_id, (item->>'prodotto_id')::uuid, item->>'nome_snapshot', (item->>'prezzo_snapshot')::numeric, (item->>'quantita')::int
  FROM jsonb_array_elements(_items) AS item;

  RETURN QUERY SELECT v_id, v_numero;
END;
$function$;
