-- Order tracking by staff member + role-based reporting.

ALTER TABLE public.ordini
  ADD COLUMN IF NOT EXISTS preso_in_carico_da uuid REFERENCES auth.users(id) DEFAULT null,
  ADD COLUMN IF NOT EXISTS preso_in_carico_at timestamptz DEFAULT null;

ALTER TABLE public.lidi
  ADD COLUMN IF NOT EXISTS storico_staff_globale boolean NOT NULL DEFAULT false;
-- false = ogni staff vede solo i propri ordini
-- true  = ogni staff vede tutti gli ordini del lido

-- Atomic "Prendi in carico" transition: only moves arrivati -> da_evadere,
-- and never overwrites preso_in_carico_da/at if already set (handles
-- concurrent clicks / re-clicks safely without a separate read-then-write
-- round trip from the client).
CREATE OR REPLACE FUNCTION public.prendi_in_carico_ordine(_id uuid)
RETURNS void
LANGUAGE sql AS $$
  UPDATE public.ordini
  SET stato = 'da_evadere',
      preso_in_carico_da = COALESCE(preso_in_carico_da, auth.uid()),
      preso_in_carico_at = COALESCE(preso_in_carico_at, now())
  WHERE id = _id AND stato = 'arrivati';
$$;

GRANT EXECUTE ON FUNCTION public.prendi_in_carico_ordine(uuid) TO authenticated;

-- Resolves auth.users emails for the report's "Gestito da" column.
-- SECURITY DEFINER is required since authenticated users have no direct
-- access to auth.users; the function enforces its own gestore/super_admin
-- check internally so it can't be used by staff to look up arbitrary
-- colleagues' emails even if called directly.
CREATE OR REPLACE FUNCTION public.get_user_emails(_user_ids uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('gestore', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::text FROM auth.users u WHERE u.id = ANY(_user_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_emails(uuid[]) TO authenticated;
