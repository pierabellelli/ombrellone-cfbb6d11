
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM ('cliente','staff','gestore','super_admin');
CREATE TYPE public.ordine_stato AS ENUM ('arrivati','da_evadere','consegnati','annullato');

-- =========================
-- UTIL
-- =========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========================
-- LIDI
-- =========================
CREATE TABLE public.lidi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  foto_copertina_url TEXT,
  servizio_bar_attivo BOOLEAN NOT NULL DEFAULT true,
  orario_apertura TIME,
  orario_chiusura TIME,
  soglia_ordine_libero NUMERIC(10,2) DEFAULT 50,
  max_ordini_ravvicinati INT DEFAULT 3,
  finestra_controllo_minuti INT DEFAULT 10,
  stripe_account_id TEXT, -- placeholder Stripe Connect
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lidi TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lidi TO authenticated;
GRANT ALL ON public.lidi TO service_role;
ALTER TABLE public.lidi ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_lidi_updated BEFORE UPDATE ON public.lidi
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lido_id UUID REFERENCES public.lidi(id) ON DELETE SET NULL,
  nome TEXT,
  cognome TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- USER ROLES
-- =========================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  lido_id UUID REFERENCES public.lidi(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, lido_id)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer (evita ricorsione RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role_in_lido(_user_id UUID, _role public.app_role, _lido_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
      AND (lido_id = _lido_id OR lido_id IS NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  );
$$;

-- Lido di un utente (gestore/staff) — primo lido assegnato
CREATE OR REPLACE FUNCTION public.user_lido_id(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lido_id FROM public.user_roles
  WHERE user_id = _user_id AND lido_id IS NOT NULL
  ORDER BY created_at ASC LIMIT 1;
$$;

-- =========================
-- CATEGORIE PRODOTTO
-- =========================
CREATE TABLE public.categorie_prodotto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lido_id UUID NOT NULL REFERENCES public.lidi(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordine INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lido_id, nome)
);
GRANT SELECT ON public.categorie_prodotto TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categorie_prodotto TO authenticated;
GRANT ALL ON public.categorie_prodotto TO service_role;
ALTER TABLE public.categorie_prodotto ENABLE ROW LEVEL SECURITY;

-- =========================
-- PRODOTTI
-- =========================
CREATE TABLE public.prodotti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lido_id UUID NOT NULL REFERENCES public.lidi(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.categorie_prodotto(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  descrizione TEXT,
  prezzo NUMERIC(10,2) NOT NULL DEFAULT 0,
  foto_url TEXT,
  disponibile BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.prodotti TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.prodotti TO authenticated;
GRANT ALL ON public.prodotti TO service_role;
ALTER TABLE public.prodotti ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_prodotti_updated BEFORE UPDATE ON public.prodotti
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- ORDINI
-- =========================
CREATE TABLE public.ordini (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lido_id UUID NOT NULL REFERENCES public.lidi(id) ON DELETE CASCADE,
  numero_ordine INT NOT NULL,
  numero_ombrellone TEXT NOT NULL,
  cognome TEXT NOT NULL,
  totale NUMERIC(10,2) NOT NULL DEFAULT 0,
  stato public.ordine_stato NOT NULL DEFAULT 'arrivati',
  note TEXT,
  stripe_payment_id TEXT, -- placeholder Stripe
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ordini_lido_data ON public.ordini(lido_id, created_at DESC);
CREATE INDEX idx_ordini_stato ON public.ordini(lido_id, stato);
GRANT SELECT, INSERT, UPDATE ON public.ordini TO authenticated;
GRANT SELECT, INSERT ON public.ordini TO anon;
GRANT ALL ON public.ordini TO service_role;
ALTER TABLE public.ordini ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_ordini_updated BEFORE UPDATE ON public.ordini
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sequenza giornaliera per lido
CREATE OR REPLACE FUNCTION public.assegna_numero_ordine()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_max INT;
BEGIN
  IF NEW.numero_ordine IS NULL OR NEW.numero_ordine = 0 THEN
    SELECT COALESCE(MAX(numero_ordine), 0) INTO v_max
      FROM public.ordini
     WHERE lido_id = NEW.lido_id
       AND created_at::date = CURRENT_DATE;
    NEW.numero_ordine = v_max + 1;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_ordini_numero BEFORE INSERT ON public.ordini
  FOR EACH ROW EXECUTE FUNCTION public.assegna_numero_ordine();

-- =========================
-- ORDINE ITEMS
-- =========================
CREATE TABLE public.ordine_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordine_id UUID NOT NULL REFERENCES public.ordini(id) ON DELETE CASCADE,
  prodotto_id UUID REFERENCES public.prodotti(id) ON DELETE SET NULL,
  nome_snapshot TEXT NOT NULL,
  prezzo_snapshot NUMERIC(10,2) NOT NULL,
  quantita INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ordine_items_ordine ON public.ordine_items(ordine_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordine_items TO authenticated;
GRANT SELECT, INSERT ON public.ordine_items TO anon;
GRANT ALL ON public.ordine_items TO service_role;
ALTER TABLE public.ordine_items ENABLE ROW LEVEL SECURITY;

-- =========================
-- RLS POLICIES
-- =========================

-- LIDI
CREATE POLICY "lidi_select_public" ON public.lidi FOR SELECT USING (true);
CREATE POLICY "lidi_update_gestore" ON public.lidi FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role_in_lido(auth.uid(),'gestore', id));
CREATE POLICY "lidi_insert_admin" ON public.lidi FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "lidi_delete_admin" ON public.lidi FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- PROFILES
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- USER ROLES
CREATE POLICY "user_roles_self_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- CATEGORIE
CREATE POLICY "categorie_select_public" ON public.categorie_prodotto FOR SELECT USING (true);
CREATE POLICY "categorie_manage_gestore" ON public.categorie_prodotto FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role_in_lido(auth.uid(),'gestore', lido_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role_in_lido(auth.uid(),'gestore', lido_id));

-- PRODOTTI
CREATE POLICY "prodotti_select_public" ON public.prodotti FOR SELECT USING (true);
CREATE POLICY "prodotti_manage_gestore" ON public.prodotti FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role_in_lido(auth.uid(),'gestore', lido_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role_in_lido(auth.uid(),'gestore', lido_id));

-- ORDINI: insert pubblico (cliente QR), select/update solo staff/gestore del lido o super_admin
CREATE POLICY "ordini_insert_public" ON public.ordini FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "ordini_select_staff" ON public.ordini FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role_in_lido(auth.uid(),'gestore', lido_id)
    OR public.has_role_in_lido(auth.uid(),'staff', lido_id)
  );
CREATE POLICY "ordini_update_staff" ON public.ordini FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role_in_lido(auth.uid(),'gestore', lido_id)
    OR public.has_role_in_lido(auth.uid(),'staff', lido_id)
  );

-- ORDINE ITEMS
CREATE POLICY "items_insert_public" ON public.ordine_items FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "items_select_staff" ON public.ordine_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordini o WHERE o.id = ordine_id AND (
        public.is_super_admin(auth.uid())
        OR public.has_role_in_lido(auth.uid(),'gestore', o.lido_id)
        OR public.has_role_in_lido(auth.uid(),'staff', o.lido_id)
      )
    )
  );

-- =========================
-- AUTO-PROFILE on signup
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, cognome)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'nome',
    NEW.raw_user_meta_data->>'cognome'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- REALTIME
-- =========================
ALTER PUBLICATION supabase_realtime ADD TABLE public.ordini;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ordine_items;

-- =========================
-- LIDO DEMO + bootstrap super admin function
-- =========================
INSERT INTO public.lidi (nome, slug, servizio_bar_attivo, orario_apertura, orario_chiusura)
VALUES ('Lido Demo', 'demo', true, '08:00', '21:00');

-- Bootstrap: chiamabile UNA volta finché non esiste alcun super_admin.
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin(_email TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role='super_admin') THEN
    RAISE EXCEPTION 'Super admin già esistente';
  END IF;
  SELECT id INTO v_user FROM auth.users WHERE email = _email LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Utente non trovato con email %', _email;
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (v_user, 'super_admin')
    ON CONFLICT DO NOTHING;
  RETURN 'OK';
END; $$;
REVOKE ALL ON FUNCTION public.bootstrap_super_admin(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_super_admin(TEXT) TO anon, authenticated;
