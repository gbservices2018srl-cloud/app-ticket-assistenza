-- ============================================================
-- SCHEMA APP ASSISTENZA STUDI
-- Da eseguire su Supabase: Dashboard > SQL Editor > New query
-- ============================================================

-- Estensioni utili
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- 1. TABELLA AZIENDE
-- ------------------------------------------------------------
create table if not exists public.aziende (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  creato_il timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. TABELLA STUDI (sedi/uffici di un'azienda)
-- ------------------------------------------------------------
create table if not exists public.studi (
  id uuid primary key default uuid_generate_v4(),
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  nome text not null,
  indirizzo text,
  creato_il timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. TABELLA PROFILI (estende auth.users con ruolo e appartenenza)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  ruolo text not null check (ruolo in ('super_admin', 'admin_azienda', 'utente_studio')),
  nome text not null,
  email text,
  azienda_id uuid references public.aziende(id) on delete set null,
  studio_id uuid references public.studi(id) on delete set null,
  creato_da uuid references public.profiles(id) on delete set null,
  creato_il timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. TABELLA TICKETS
-- ------------------------------------------------------------
create table if not exists public.tickets (
  id uuid primary key default uuid_generate_v4(),
  studio_id uuid not null references public.studi(id) on delete cascade,
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  creato_da uuid references public.profiles(id) on delete set null,
  tipo text not null check (tipo in ('problema_generico', 'guasto_attrezzatura')),
  titolo text not null,
  descrizione text not null,
  stato text not null default 'aperto' check (stato in ('aperto', 'in_lavorazione', 'risolto')),
  assegnato_a uuid references public.profiles(id) on delete set null,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  presa_in_carico_il timestamptz,
  risolto_il timestamptz
);

-- ------------------------------------------------------------
-- 5. TABELLA ALLEGATI (foto obbligatoria per guasti)
-- ------------------------------------------------------------
create table if not exists public.ticket_allegati (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  storage_path text not null,
  caricato_il timestamptz not null default now(),
  scaricato boolean not null default false,
  scaricato_il timestamptz,
  scaricato_da uuid references public.profiles(id) on delete set null,
  eliminato boolean not null default false
);

-- ------------------------------------------------------------
-- 6. TABELLA SOLUZIONI (testo scritto quando si risolve un ticket)
-- ------------------------------------------------------------
create table if not exists public.ticket_soluzioni (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  testo_soluzione text not null,
  risolto_da uuid references public.profiles(id) on delete set null,
  risolto_il timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TRIGGER: aggiorna "aggiornato_il" ad ogni update del ticket
-- ------------------------------------------------------------
create or replace function public.aggiorna_timestamp()
returns trigger as $$
begin
  new.aggiornato_il = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_aggiorna_ticket on public.tickets;
create trigger trg_aggiorna_ticket
before update on public.tickets
for each row execute function public.aggiorna_timestamp();

-- ------------------------------------------------------------
-- TRIGGER: valida foto obbligatoria per guasti attrezzatura
-- (si applica quando il ticket passa da 'aperto' in avanti;
--  il controllo vero e proprio va comunque fatto anche lato
--  applicazione, qui è una rete di sicurezza)
-- ------------------------------------------------------------
create or replace function public.controlla_allegato_guasto()
returns trigger as $$
declare
  conteggio int;
begin
  if new.tipo = 'guasto_attrezzatura' then
    select count(*) into conteggio from public.ticket_allegati where ticket_id = new.id and eliminato = false;
    if conteggio = 0 and TG_OP = 'UPDATE' and old.tipo = 'guasto_attrezzatura' then
      -- consente la creazione iniziale (l'allegato viene caricato subito dopo l'insert)
      null;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table public.aziende enable row level security;
alter table public.studi enable row level security;
alter table public.profiles enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_allegati enable row level security;
alter table public.ticket_soluzioni enable row level security;

-- Funzione helper: ruolo dell'utente corrente
create or replace function public.mio_ruolo()
returns text as $$
  select ruolo from public.profiles where id = auth.uid();
$$ language sql stable security definer;

create or replace function public.mia_azienda()
returns uuid as $$
  select azienda_id from public.profiles where id = auth.uid();
$$ language sql stable security definer;

create or replace function public.mio_studio()
returns uuid as $$
  select studio_id from public.profiles where id = auth.uid();
$$ language sql stable security definer;

-- ---------- POLICY: profiles ----------
create policy "profiles_select" on public.profiles for select
using (
  id = auth.uid()
  or public.mio_ruolo() = 'super_admin'
  or (public.mio_ruolo() = 'admin_azienda' and azienda_id = public.mia_azienda())
);

create policy "profiles_insert" on public.profiles for insert
with check (
  public.mio_ruolo() = 'super_admin'
  or (public.mio_ruolo() = 'admin_azienda' and azienda_id = public.mia_azienda() and ruolo = 'utente_studio')
);

create policy "profiles_update" on public.profiles for update
using (
  public.mio_ruolo() = 'super_admin'
  or (public.mio_ruolo() = 'admin_azienda' and azienda_id = public.mia_azienda())
);

-- ---------- POLICY: aziende ----------
create policy "aziende_select" on public.aziende for select
using (
  public.mio_ruolo() = 'super_admin'
  or id = public.mia_azienda()
);

create policy "aziende_insert" on public.aziende for insert
with check (public.mio_ruolo() = 'super_admin');

create policy "aziende_update" on public.aziende for update
using (public.mio_ruolo() = 'super_admin');

-- ---------- POLICY: studi ----------
create policy "studi_select" on public.studi for select
using (
  public.mio_ruolo() = 'super_admin'
  or azienda_id = public.mia_azienda()
  or id = public.mio_studio()
);

create policy "studi_insert" on public.studi for insert
with check (
  public.mio_ruolo() = 'super_admin'
  or (public.mio_ruolo() = 'admin_azienda' and azienda_id = public.mia_azienda())
);

create policy "studi_update" on public.studi for update
using (
  public.mio_ruolo() = 'super_admin'
  or (public.mio_ruolo() = 'admin_azienda' and azienda_id = public.mia_azienda())
);

-- ---------- POLICY: tickets ----------
create policy "tickets_select" on public.tickets for select
using (
  public.mio_ruolo() = 'super_admin'
  or (public.mio_ruolo() = 'admin_azienda' and azienda_id = public.mia_azienda())
  or (public.mio_ruolo() = 'utente_studio' and studio_id = public.mio_studio())
);

create policy "tickets_insert" on public.tickets for insert
with check (
  public.mio_ruolo() = 'utente_studio' and studio_id = public.mio_studio()
  or public.mio_ruolo() = 'admin_azienda' and azienda_id = public.mia_azienda()
  or public.mio_ruolo() = 'super_admin'
);

create policy "tickets_update" on public.tickets for update
using (
  public.mio_ruolo() = 'super_admin'
  or (public.mio_ruolo() = 'admin_azienda' and azienda_id = public.mia_azienda())
);

-- ---------- POLICY: ticket_allegati ----------
create policy "allegati_select" on public.ticket_allegati for select
using (
  exists (
    select 1 from public.tickets t
    where t.id = ticket_id
    and (
      public.mio_ruolo() = 'super_admin'
      or (public.mio_ruolo() = 'admin_azienda' and t.azienda_id = public.mia_azienda())
      or (public.mio_ruolo() = 'utente_studio' and t.studio_id = public.mio_studio())
    )
  )
);

create policy "allegati_insert" on public.ticket_allegati for insert
with check (
  exists (
    select 1 from public.tickets t
    where t.id = ticket_id
    and (
      (public.mio_ruolo() = 'utente_studio' and t.studio_id = public.mio_studio())
      or public.mio_ruolo() in ('admin_azienda','super_admin')
    )
  )
);

create policy "allegati_update" on public.ticket_allegati for update
using (
  public.mio_ruolo() in ('admin_azienda', 'super_admin')
);

-- ---------- POLICY: ticket_soluzioni ----------
create policy "soluzioni_select" on public.ticket_soluzioni for select
using (
  exists (
    select 1 from public.tickets t
    where t.id = ticket_id
    and (
      public.mio_ruolo() = 'super_admin'
      or (public.mio_ruolo() = 'admin_azienda' and t.azienda_id = public.mia_azienda())
      or (public.mio_ruolo() = 'utente_studio' and t.studio_id = public.mio_studio())
    )
  )
);

create policy "soluzioni_insert" on public.ticket_soluzioni for insert
with check (
  public.mio_ruolo() in ('admin_azienda', 'super_admin')
);

-- ------------------------------------------------------------
-- STORAGE BUCKET per le foto degli allegati
-- (da creare anche via UI: Storage > New bucket > "allegati-ticket", privato)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('allegati-ticket', 'allegati-ticket', false)
on conflict (id) do nothing;

-- Policy storage: solo utenti autenticati collegati al ticket possono leggere/scrivere
create policy "storage_allegati_select" on storage.objects for select
using (
  bucket_id = 'allegati-ticket'
  and auth.role() = 'authenticated'
);

create policy "storage_allegati_insert" on storage.objects for insert
with check (
  bucket_id = 'allegati-ticket'
  and auth.role() = 'authenticated'
);

create policy "storage_allegati_delete" on storage.objects for delete
using (
  bucket_id = 'allegati-ticket'
  and auth.role() = 'authenticated'
);

-- ------------------------------------------------------------
-- PERMESSI DI ELIMINAZIONE (profili, studi, aziende)
-- ------------------------------------------------------------
create policy "aziende_delete" on public.aziende for delete
using (public.mio_ruolo() = 'super_admin');

create policy "studi_delete" on public.studi for delete
using (
  public.mio_ruolo() = 'super_admin'
  or (public.mio_ruolo() = 'admin_azienda' and azienda_id = public.mia_azienda())
);

create policy "profiles_delete" on public.profiles for delete
using (
  public.mio_ruolo() = 'super_admin'
  or (public.mio_ruolo() = 'admin_azienda' and azienda_id = public.mia_azienda() and ruolo = 'utente_studio')
);

-- ------------------------------------------------------------
-- REALTIME (necessario per le notifiche di nuovo ticket)
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.tickets;
