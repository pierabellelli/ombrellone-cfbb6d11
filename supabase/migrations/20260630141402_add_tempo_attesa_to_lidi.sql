ALTER TABLE public.lidi ADD COLUMN tempo_attesa_attivo boolean NOT NULL DEFAULT false;
ALTER TABLE public.lidi ADD COLUMN tempo_attesa_minuti integer NULL;
