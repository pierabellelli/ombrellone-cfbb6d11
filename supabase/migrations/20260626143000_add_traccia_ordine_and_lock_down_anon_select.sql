-- Applied directly to vkpckptflbhueseszvqp (the real, user-owned project --
-- distinct from the rest of this migration history, which targets a
-- different/unrelated Lovable-provisioned project). Recorded here so the
-- repo reflects what's actually live.
--
-- 1. traccia_ordine: pre-existing frontend feature (traccia.$slug.tsx) that
--    had no backing function on this project.
-- 2. get_order_history: backing function for the customer order-history
--    widget (lido.$slug.tsx), introduced to replace an open anon SELECT.
-- 3. Drops anon_select_ordini / anon_select_items, which used USING (true)
--    and let anyone read every customer's name/phone/total/payment method
--    without authenticating. get_order_history is the narrow replacement.

CREATE OR REPLACE FUNCTION public.traccia_ordine(_slug text, _numero int, _cognome text)
RETURNS TABLE (
  id uuid,
  numero_ordine int,
  numero_ombrellone text,
  cognome text,
  totale numeric,
  stato text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.numero_ordine, o.numero_ombrellone, o.cognome, o.totale, o.stato::text, o.created_at
  FROM public.ordini o
  JOIN public.lidi l ON l.id = o.lido_id
  WHERE l.slug = _slug
    AND o.numero_ordine = _numero
    AND lower(trim(o.cognome)) = lower(trim(_cognome))
    AND o.created_at::date = CURRENT_DATE
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.traccia_ordine(text, int, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_order_history(_lido_id uuid, _telefono text)
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
  WHERE o.lido_id = _lido_id AND o.telefono = _telefono
  ORDER BY o.created_at DESC
  LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_history(uuid, text) TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_ordini" ON public.ordini;
DROP POLICY IF EXISTS "anon_select_items" ON public.ordine_items;
