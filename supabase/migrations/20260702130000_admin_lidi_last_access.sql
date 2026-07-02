-- Ultimo accesso del/i gestore/i di ogni lido, per la dashboard super-admin.
-- auth.users non è leggibile dal client: esposto solo tramite questa funzione,
-- riservata ai super-admin, sullo stesso pattern di public.get_user_emails.
CREATE OR REPLACE FUNCTION public.admin_lidi_last_access()
RETURNS TABLE(lido_id uuid, last_sign_in_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT ur.lido_id, MAX(u.last_sign_in_at)
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.role = 'gestore' AND ur.lido_id IS NOT NULL
  GROUP BY ur.lido_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_lidi_last_access() TO authenticated;
