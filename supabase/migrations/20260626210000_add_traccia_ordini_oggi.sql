-- Order-tracking RPC for the public lido page's "Traccia il tuo ordine"
-- flow. Note: the feature spec assumed anon_select_ordini still existed
-- to allow a direct table query; that policy was intentionally dropped
-- in 20260626143000 to close a PII leak (anon could read every order's
-- name/phone/total). Re-opening it would reintroduce that leak, so this
-- uses the same narrow SECURITY DEFINER pattern as get_order_history/
-- create_ordine instead.

CREATE OR REPLACE FUNCTION public.traccia_ordini_oggi(_lido_id uuid, _numero_ombrellone text, _telefono text)
RETURNS TABLE (
  id uuid,
  numero_ordine int,
  numero_ombrellone text,
  totale numeric,
  stato public.stato_ordine,
  created_at timestamptz,
  items jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    o.id, o.numero_ordine, o.numero_ombrellone, o.totale, o.stato, o.created_at,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('nome_snapshot', oi.nome_snapshot, 'quantita', oi.quantita))
       FROM public.ordine_items oi WHERE oi.ordine_id = o.id),
      '[]'::jsonb
    ) AS items
  FROM public.ordini o
  WHERE o.lido_id = _lido_id
    AND o.numero_ombrellone = _numero_ombrellone
    AND o.telefono ILIKE '%' || _telefono || '%'
    AND o.created_at >= CURRENT_DATE
    AND o.stato != 'annullato'
  ORDER BY o.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.traccia_ordini_oggi(uuid, text, text) TO anon, authenticated;
