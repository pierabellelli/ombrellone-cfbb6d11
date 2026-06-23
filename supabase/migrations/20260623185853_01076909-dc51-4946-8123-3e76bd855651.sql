
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
