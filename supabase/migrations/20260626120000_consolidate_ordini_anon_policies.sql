-- Consolidate duplicate anon RLS policies on ordini/ordine_items introduced
-- across 20260625153655 and 20260625153925.
--
-- Anon INSERT is already covered by "ordini_insert_public" / "items_insert_public"
-- (TO anon, authenticated, WITH CHECK true) from the initial schema migration,
-- so the anon-only INSERT duplicates added later are redundant and dropped here.
--
-- Anon SELECT was duplicated by name across the two later migrations
-- (anon_select_ordini / ordini_anon_select, anon_select_ordine_items /
-- ordine_items_anon_select) — both pairs are functionally identical
-- (USING (true)). Exactly one of each is kept; it's required by the
-- client-side order-history lookup in lido.$slug.tsx (OrderHistorySection).

DROP POLICY IF EXISTS "anon_insert_ordini" ON public.ordini;
DROP POLICY IF EXISTS "ordini_anon_insert" ON public.ordini;
DROP POLICY IF EXISTS "ordini_anon_select" ON public.ordini;

DROP POLICY IF EXISTS "anon_insert_ordine_items" ON public.ordine_items;
DROP POLICY IF EXISTS "ordine_items_anon_insert" ON public.ordine_items;
DROP POLICY IF EXISTS "ordine_items_anon_select" ON public.ordine_items;
