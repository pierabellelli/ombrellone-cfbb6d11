-- beach_config has no anon SELECT policy (it's staff-managed data), but the
-- public booking form needs the physical layout (rows/umbrella numbers) to
-- render the availability map. Expose only the layout, nothing sensitive.
CREATE OR REPLACE FUNCTION public.get_public_beach_layout(_lido_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT file FROM public.beach_config WHERE lido_id = _lido_id;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_beach_layout(uuid) TO anon, authenticated;
