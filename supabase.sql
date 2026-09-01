create extension if not exists pgcrypto;

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  artist text not null,
  title text not null,
  release_year integer check (release_year between 1900 and 2100),
  genre text,
  format text not null default 'LP',
  vinyl_condition text not null default 'Near Mint (NM)',
  sleeve_condition text not null default 'Near Mint (NM)',
  record_label text,
  catalog_number text,
  country text,
  purchase_price numeric(10,2) check (purchase_price >= 0),
  estimated_value numeric(10,2) check (estimated_value >= 0),
  acquired_date date,
  location text,
  cover_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists albums_user_id_idx on public.albums(user_id);
create index if not exists albums_artist_title_idx on public.albums(artist, title);
alter table public.albums enable row level security;

drop policy if exists "Users can view own albums" on public.albums;
create policy "Users can view own albums" on public.albums for select using (auth.uid() = user_id);
drop policy if exists "Users can add own albums" on public.albums;
create policy "Users can add own albums" on public.albums for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own albums" on public.albums;
create policy "Users can update own albums" on public.albums for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own albums" on public.albums;
create policy "Users can delete own albums" on public.albums for delete using (auth.uid() = user_id);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists albums_set_updated_at on public.albums;
create trigger albums_set_updated_at before update on public.albums for each row execute function public.set_updated_at();
