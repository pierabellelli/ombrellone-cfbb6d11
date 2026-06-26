-- Fixes a regression from 20260626143000: dropping anon_select_ordini/
-- anon_select_items (to close the PII leak) broke customer order
-- submission, because `.insert(...).select(...)` translates to
-- `INSERT ... RETURNING`, which Postgres also checks against the
-- table's SELECT policy -- anon had none left, so every order
-- submission failed with "new row violates row-level security policy
-- for table ordini".
--
-- Fix: a SECURITY DEFINER RPC that performs both inserts (ordini +
-- ordine_items) and returns id/numero_ordine, bypassing RLS entirely
-- so no SELECT grant is needed for anon at all. This also incidentally
-- fixes the ordini_numero_ordine trigger's internal SELECT (used to
-- compute the next numero_ordine for the day), which was likewise
-- silently starved of visibility under the old anon role and was
-- always computing numero_ordine = 1 for anon-submitted orders.

CREATE OR REPLACE FUNCTION public.create_ordine(
  _lido_id uuid, _numero_ombrellone text, _cognome text, _telefono text,
  _totale numeric, _note text, _metodo_pagamento text, _items jsonb
)
RETURNS TABLE(id uuid, numero_ordine int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_numero int;
BEGIN
  INSERT INTO public.ordini (lido_id, numero_ombrellone, cognome, telefono, totale, note, metodo_pagamento, numero_ordine)
  VALUES (_lido_id, _numero_ombrellone, _cognome, _telefono, _totale, _note, _metodo_pagamento, 0)
  RETURNING ordini.id, ordini.numero_ordine INTO v_id, v_numero;

  INSERT INTO public.ordine_items (ordine_id, prodotto_id, nome_snapshot, prezzo_snapshot, quantita)
  SELECT v_id, (item->>'prodotto_id')::uuid, item->>'nome_snapshot', (item->>'prezzo_snapshot')::numeric, (item->>'quantita')::int
  FROM jsonb_array_elements(_items) AS item;

  RETURN QUERY SELECT v_id, v_numero;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_ordine(uuid,text,text,text,numeric,text,text,jsonb) TO anon, authenticated;
