
ALTER TABLE public.prodotti ADD COLUMN IF NOT EXISTS immagine_url text;
ALTER TABLE public.lidi ADD COLUMN IF NOT EXISTS accetta_carta boolean NOT NULL DEFAULT false;
