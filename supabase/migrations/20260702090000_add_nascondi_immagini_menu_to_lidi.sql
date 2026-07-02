-- Permette al gestore di nascondere le immagini prodotto nel menu cliente
-- (utile quando non ha foto per tutti i prodotti e preferisce un menu senza placeholder).
alter table public.lidi
  add column if not exists nascondi_immagini_menu boolean not null default false;
