
-- Add operative fields to ordini
ALTER TABLE public.ordini
  ADD COLUMN IF NOT EXISTS telefono text,
  ADD COLUMN IF NOT EXISTS metodo_pagamento text,
  ADD COLUMN IF NOT EXISTS fila text;

ALTER TABLE public.ordini
  DROP CONSTRAINT IF EXISTS ordini_metodo_pagamento_check;
ALTER TABLE public.ordini
  ADD CONSTRAINT ordini_metodo_pagamento_check
  CHECK (metodo_pagamento IS NULL OR metodo_pagamento IN ('contanti','carta'));

-- Beach config table (one row per lido)
CREATE TABLE IF NOT EXISTS public.beach_config (
  lido_id uuid PRIMARY KEY REFERENCES public.lidi(id) ON DELETE CASCADE,
  numero_file integer NOT NULL DEFAULT 0,
  numerazione text NOT NULL DEFAULT 'auto_lr'
    CHECK (numerazione IN ('auto_lr','auto_rl','manuale')),
  file jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.beach_config TO authenticated;
GRANT ALL ON public.beach_config TO service_role;

ALTER TABLE public.beach_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "beach_config_read" ON public.beach_config;
CREATE POLICY "beach_config_read" ON public.beach_config
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role_in_lido(auth.uid(), 'gestore', lido_id)
    OR public.has_role_in_lido(auth.uid(), 'staff', lido_id)
  );

DROP POLICY IF EXISTS "beach_config_write" ON public.beach_config;
CREATE POLICY "beach_config_write" ON public.beach_config
  FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role_in_lido(auth.uid(), 'gestore', lido_id)
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.has_role_in_lido(auth.uid(), 'gestore', lido_id)
  );

DROP TRIGGER IF EXISTS beach_config_updated_at ON public.beach_config;
CREATE TRIGGER beach_config_updated_at
  BEFORE UPDATE ON public.beach_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER TABLE public.ordini REPLICA IDENTITY FULL;
ALTER TABLE public.beach_config REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ordini;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.beach_config;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
