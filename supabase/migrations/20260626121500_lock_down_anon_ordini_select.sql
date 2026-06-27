-- anon_select_ordini / anon_select_ordine_items used USING (true), letting any
-- request with the public anon key dump every customer's name, phone, total,
-- and payment method across every lido. The app only ever needs this to show
-- a customer their own recent orders by phone number (lido.$slug.tsx,
-- OrderHistorySection), so replace the open table-level SELECT with a narrow
-- SECURITY DEFINER RPC that returns just that shape, scoped to the caller's
-- own (lido_id, telefono) pair, capped at 5 rows.

DROP POLICY IF EXISTS "anon_select_ordini" ON public.ordini;
DROP POLICY IF EXISTS "anon_select_ordine_items" ON public.ordine_items;

CREATE OR REPLACE FUNCTION public.get_order_history(_lido_id UUID, _telefono TEXT)
RETURNS TABLE (
  id UUID,
  numero_ordine INT,
  numero_ombrellone TEXT,
  totale NUMERIC(10,2),
  stato public.ordine_stato,
  created_at TIMESTAMPTZ,
  items JSONB
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    o.id, o.numero_ordine, o.numero_ombrellone, o.totale, o.stato, o.created_at,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('nome_snapshot', oi.nome_snapshot, 'quantita', oi.quantita))
       FROM public.ordine_items oi WHERE oi.ordine_id = o.id),
      '[]'::jsonb
    ) AS items
  FROM public.ordini o
  WHERE o.lido_id = _lido_id AND o.telefono = _telefono
  ORDER BY o.created_at DESC
  LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_history(UUID, TEXT) TO anon, authenticated;
