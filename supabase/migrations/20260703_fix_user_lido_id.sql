-- Fix: user_lido_id() returned a non-deterministic row for users with multiple
-- user_roles entries (e.g. gestore + super_admin), sometimes resolving to the
-- row with lido_id IS NULL and leaving /mappa empty for those users, while
-- /configurazione-lido (which resolves lido_id manually client-side, preferring
-- the "gestore" row) kept working.
--
-- Diagnosed 2026-07-03 against the live DB: piera.bellelli@gmail.com has a
-- gestore row (lido_id = 44a0ec17-e742-451c-8fab-a1be95d21fa9, Lido Test/demo)
-- and a super_admin row (lido_id = NULL). The previous function had no
-- ORDER BY, so `LIMIT 1` could return either row.
--
-- Note: this replaces the live zero-arg overload public.user_lido_id(), which
-- was created directly via the Supabase SQL Editor and was never captured in
-- migrations (see project schema-drift notes). It does not touch the separate,
-- unused public.user_lido_id(_user_id UUID) overload from migration
-- 20260623184125_5c37a979-bdfa-4609-9c1a-ee767ea69442.sql.
CREATE OR REPLACE FUNCTION public.user_lido_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT lido_id FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY (lido_id IS NULL), created_at ASC
  LIMIT 1;
$function$;
