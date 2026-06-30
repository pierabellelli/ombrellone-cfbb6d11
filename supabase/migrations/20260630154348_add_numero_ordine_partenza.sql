ALTER TABLE public.lidi ADD COLUMN numero_ordine_partenza integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.assegna_numero_ordine()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_max INT;
  v_partenza INT;
BEGIN
  IF NEW.numero_ordine IS NULL OR NEW.numero_ordine = 0 THEN
    SELECT numero_ordine_partenza INTO v_partenza
      FROM public.lidi
     WHERE id = NEW.lido_id;

    SELECT COALESCE(MAX(numero_ordine), COALESCE(v_partenza, 1) - 1) INTO v_max
      FROM public.ordini
     WHERE lido_id = NEW.lido_id;

    NEW.numero_ordine = v_max + 1;
  END IF;
  RETURN NEW;
END; $$;
