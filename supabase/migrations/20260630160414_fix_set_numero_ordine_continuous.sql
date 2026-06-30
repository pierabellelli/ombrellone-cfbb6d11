-- The trigger actually wired to public.ordini (BEFORE INSERT) is
-- ordini_numero_ordine -> public.set_numero_ordine(), NOT the
-- trg_ordini_numero -> assegna_numero_ordine() pair from migration
-- 20260623184125 (that trigger no longer exists on the table) and NOT
-- the assegna_numero_ordine() update from 20260630154348 (dead code,
-- no trigger calls it). set_numero_ordine() was created directly in
-- the Supabase SQL editor at some point and was never captured in a
-- migration file, so the 20260630154348 fix had no effect in practice.
--
-- This applies the same continuous-numbering fix (drop the
-- DATE(created_at) = DATE(now()) filter, fall back to
-- lidi.numero_ordine_partenza when the lido has no orders yet) to the
-- function that is actually in use.

CREATE OR REPLACE FUNCTION public.set_numero_ordine()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_max INT;
  v_partenza INT;
BEGIN
  SELECT numero_ordine_partenza INTO v_partenza
    FROM public.lidi
   WHERE id = NEW.lido_id;

  SELECT COALESCE(MAX(numero_ordine), COALESCE(v_partenza, 1) - 1) INTO v_max
    FROM public.ordini
   WHERE lido_id = NEW.lido_id;

  NEW.numero_ordine = v_max + 1;
  RETURN NEW;
END;
$$;

-- assegna_numero_ordine() (introduced in 20260623184125, "fixed" in
-- 20260630154348) has no trigger calling it on this DB -- drop the
-- dead code so there's only one numero_ordine function to reason about.
DROP FUNCTION IF EXISTS public.assegna_numero_ordine();
