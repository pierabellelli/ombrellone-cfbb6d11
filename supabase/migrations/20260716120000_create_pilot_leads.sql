-- Programma Pilota: form di candidatura sulla landing page.
-- Anon può solo inserire (lead capture); solo super_admin può leggere,
-- aggiornare lo status o cancellare i lead, seguendo il pattern RLS
-- esistente (public.is_super_admin, vedi 20260623184125_...).

CREATE TYPE public.pilot_lead_status AS ENUM (
  'new',
  'contacted',
  'qualified',
  'accepted',
  'rejected',
  'archived'
);

CREATE TABLE IF NOT EXISTS public.pilot_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  nome text NOT NULL,
  cognome text NOT NULL,
  nome_lido text NOT NULL,
  localita text NOT NULL,
  telefono text NOT NULL,
  email text NOT NULL,
  numero_ombrelloni integer NOT NULL CHECK (numero_ombrelloni > 0),
  bar_attivo boolean NOT NULL DEFAULT true,
  note text,
  status public.pilot_lead_status NOT NULL DEFAULT 'new',
  status_updated_at timestamptz NOT NULL DEFAULT now(),
  admin_notes text
);

CREATE INDEX IF NOT EXISTS idx_pilot_leads_status ON public.pilot_leads (status);

ALTER TABLE public.pilot_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_pilot_leads"
  ON public.pilot_leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "super_admin_select_pilot_leads"
  ON public.pilot_leads
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "super_admin_update_pilot_leads"
  ON public.pilot_leads
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "super_admin_delete_pilot_leads"
  ON public.pilot_leads
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Aggiorna status_updated_at solo quando lo status cambia davvero.
CREATE OR REPLACE FUNCTION public.set_pilot_lead_status_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.status IS DISTINCT FROM old.status THEN
    new.status_updated_at := now();
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_pilot_leads_status_updated_at ON public.pilot_leads;
CREATE TRIGGER trg_pilot_leads_status_updated_at
  BEFORE UPDATE ON public.pilot_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pilot_lead_status_updated_at();

-- Notifica via email (Edge Function send-pilot-lead-email) ad ogni nuova
-- candidatura. Usa pg_net per una chiamata HTTP asincrona: non blocca né
-- fa fallire l'INSERT su public.pilot_leads se l'invio email fallisce.
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'pilot_lead_webhook_secret') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'pilot_lead_webhook_secret');
  end if;
end $$;

create or replace function public.notify_pilot_lead_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  webhook_secret text;
begin
  begin
    select decrypted_secret into webhook_secret
    from vault.decrypted_secrets
    where name = 'pilot_lead_webhook_secret';

    perform net.http_post(
      url := 'https://vkpckptflbhueseszvqp.supabase.co/functions/v1/send-pilot-lead-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', webhook_secret
      ),
      body := jsonb_build_object(
        'nome', new.nome,
        'cognome', new.cognome,
        'nome_lido', new.nome_lido,
        'localita', new.localita,
        'telefono', new.telefono,
        'email', new.email,
        'numero_ombrelloni', new.numero_ombrelloni,
        'bar_attivo', new.bar_attivo,
        'note', new.note
      )
    );
  exception when others then
    -- La notifica email è solo un side-effect: un errore qui non deve mai
    -- far fallire il salvataggio della candidatura.
    null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_pilot_leads_notify on public.pilot_leads;
create trigger trg_pilot_leads_notify
  after insert on public.pilot_leads
  for each row
  execute function public.notify_pilot_lead_insert();

-- ============================================================
-- ROLLBACK (eseguire manualmente se necessario, non fa parte
-- della migration):
-- ============================================================
-- drop trigger if exists trg_pilot_leads_notify on public.pilot_leads;
-- drop function if exists public.notify_pilot_lead_insert();
-- drop trigger if exists trg_pilot_leads_status_updated_at on public.pilot_leads;
-- drop function if exists public.set_pilot_lead_status_updated_at();
-- drop policy if exists "super_admin_delete_pilot_leads" on public.pilot_leads;
-- drop policy if exists "super_admin_update_pilot_leads" on public.pilot_leads;
-- drop policy if exists "super_admin_select_pilot_leads" on public.pilot_leads;
-- drop policy if exists "anon_insert_pilot_leads" on public.pilot_leads;
-- drop index if exists public.idx_pilot_leads_status;
-- drop table if exists public.pilot_leads;
-- drop type if exists public.pilot_lead_status;
-- delete from vault.secrets where name = 'pilot_lead_webhook_secret';
