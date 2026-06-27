-- Public landing page "Richiedi una demo" contact form.
-- Anon can only insert (lead capture); no select/update/delete so
-- submitted leads aren't readable or tamperable from the client.

CREATE TABLE IF NOT EXISTS public.contatti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL,
  nome_lido text NOT NULL,
  citta text NOT NULL,
  messaggio text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.contatti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_contatti"
  ON public.contatti
  FOR INSERT
  TO anon
  WITH CHECK (true);
