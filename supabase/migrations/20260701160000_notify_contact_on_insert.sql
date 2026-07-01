-- Notifica via email (Edge Function notify-contact) ad ogni nuovo contatto dal form landing.
-- Usa pg_net per una chiamata HTTP asincrona: non blocca né fa fallire l'INSERT su
-- public.contatti se l'invio dell'email fallisce o l'extension/rete non risponde.

create extension if not exists pg_net with schema extensions;

-- Segreto condiviso tra questo trigger e la Edge Function (verificato via header
-- x-webhook-secret, dato che la chiamata parte da Postgres e non da un utente loggato).
-- Il valore reale viene impostato manualmente dopo la migration (vedi istruzioni deploy),
-- qui creiamo solo il posto dove salvarlo se non esiste già.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'notify_contact_webhook_secret') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'notify_contact_webhook_secret');
  end if;
end $$;

create or replace function public.notify_contatto_insert()
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
    where name = 'notify_contact_webhook_secret';

    perform net.http_post(
      url := 'https://vkpckptflbhueseszvqp.supabase.co/functions/v1/notify-contact',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', webhook_secret
      ),
      body := jsonb_build_object(
        'nome', new.nome,
        'email', new.email,
        'nome_lido', new.nome_lido,
        'citta', new.citta,
        'messaggio', new.messaggio
      )
    );
  exception when others then
    -- La notifica email è solo un side-effect: un errore qui non deve mai
    -- far fallire il salvataggio del contatto.
    null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_contatti_notify on public.contatti;
create trigger trg_contatti_notify
  after insert on public.contatti
  for each row
  execute function public.notify_contatto_insert();
