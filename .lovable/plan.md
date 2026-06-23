# LidoSmart — Piano MVP

Sistema di ordinazione QR multi-lido. Italiano. Palette navy `#1B3A6B` + teal `#2DD4BF`, sfondo azzurro tenue, card bianche arrotondate.

## Cosa costruisco in questo primo round

Per partire serve l'infrastruttura (Lovable Cloud + schema DB + auth + ruoli) **prima** di poter avere login funzionante e Kanban realistico. Quindi questo primo round consegna:

1. **Lovable Cloud attivo** (auth, DB, storage).
2. **Schema DB completo** (tutte le tabelle del progetto, anche quelle che useremo dopo, così le RLS sono coerenti da subito).
3. **Sistema ruoli** (`cliente`, `staff`, `gestore`, `super_admin`) in tabella `user_roles` separata + funzione `has_role` security definer.
4. **Design system** in `src/styles.css` (palette, tipografia, varianti bottone/badge).
5. **Pagina `/login`** staff/gestore — sfondo spiaggia, card bianca, logo LidoSmart, form email+password, bottone Home.
6. **Layout autenticato** con gate `_authenticated/route.tsx`.
7. **Dashboard `/ordini`** — Kanban a 3 colonne (Arrivati / Da evadere / Consegnati), toggle Coda/Storico, ricerca, contatori, card ordine con avanza/indietro, realtime via Supabase.
8. **Home `/`** minimale: spiegazione + bottone "Area staff".

Tutto il resto (gestione prodotti, impostazioni/branding, area cliente QR, super-admin `/admin`, gancio Stripe) sarà costruito nei round successivi su questa base, senza rifare migrazioni.

## Schema DB (migrazione unica)

```text
lidi
  id, nome, slug, logo_url, foto_copertina_url,
  servizio_bar_attivo bool default true,
  orario_apertura time, orario_chiusura time,
  soglia_ordine_libero numeric, max_ordini_ravvicinati int,
  finestra_controllo_minuti int,
  stripe_account_id text null,  -- placeholder futuro
  created_at

profiles
  id (= auth.users.id), lido_id (fk lidi, nullable per super_admin),
  nome, cognome, created_at

app_role enum: 'cliente' | 'staff' | 'gestore' | 'super_admin'
user_roles
  id, user_id, role, lido_id (nullable), unique(user_id, role, lido_id)

categorie_prodotto
  id, lido_id, nome, ordine int

prodotti
  id, lido_id, categoria_id, nome, descrizione,
  prezzo numeric, foto_url, disponibile bool default true, created_at

ordini
  id, lido_id, numero_ordine int (sequenza giornaliera per lido),
  numero_ombrellone text, cognome text,
  totale numeric, stato text check in ('arrivati','da_evadere','consegnati'),
  stripe_payment_id text null,  -- placeholder
  created_at, updated_at

ordine_items
  id, ordine_id, prodotto_id, nome_snapshot, prezzo_snapshot,
  quantita int
```

RLS:
- `lidi`: SELECT pubblico (per pagina cliente via slug); UPDATE solo `gestore` del proprio lido o `super_admin`.
- `prodotti`/`categorie_prodotto`: SELECT pubblico (menu QR); INSERT/UPDATE/DELETE solo gestore del lido o super_admin.
- `ordini`/`ordine_items`: INSERT pubblico (cliente senza login, scoped al `lido_id` del QR); SELECT/UPDATE solo staff/gestore di quel lido + super_admin.
- `profiles`: utente vede il proprio; super_admin vede tutto.
- `user_roles`: utente legge i propri; super_admin gestisce.

Funzione `public.has_role(_user_id, _role, _lido_id default null)` security definer.

Trigger `handle_new_user` per creare profilo a signup (senza ruolo: il ruolo lo assegna gestore/super_admin).

GRANT espliciti `TO authenticated` e `TO anon` dove necessario.

## Dettagli tecnici

- TanStack Start, file-based routes.
- `src/routes/_authenticated/route.tsx` (managed style, `ssr: false`) protegge `/ordini`, `/prodotti`, `/impostazioni`, `/admin`.
- Realtime: subscription a `ordini` filtrata per `lido_id` nel componente Kanban.
- Drag&drop Kanban: uso `@dnd-kit/core` + bottoni accessibili come fallback.
- Storage buckets: `loghi-lidi` (pubblico), `foto-prodotti` (pubblico). Creati nel round prodotti/impostazioni.
- Niente Stripe ora — solo colonne `stripe_payment_id` / `stripe_account_id` nullable.
- `/admin` non sarà nella nav: link assente, accesso solo digitando l'URL + check ruolo `super_admin`.

## Cosa NON è in questo round

- Pagina cliente QR (`/lido/:slug`) e flusso carrello
- `/prodotti` (gestione menu con upload foto)
- `/impostazioni` (branding + regole servizio)
- `/admin` super-admin
- Seed di un lido demo e creazione utenti staff/gestore (ti guiderò dopo l'attivazione di Cloud per creare il primo gestore)

Confermi e procedo? Oppure preferisci che includa anche `/prodotti` e `/impostazioni` in questo primo round (sarà più lungo)?
