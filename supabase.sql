create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
drop policy if exists "Authenticated users can view profiles" on public.profiles;
create policy "Authenticated users can view profiles" on public.profiles for select to authenticated using (true);
drop policy if exists "Users can create own profile" on public.profiles;
create policy "Users can create own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into public.profiles (id, username)
select id, split_part(email,'@',1) from auth.users
on conflict (id) do nothing;

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
drop policy if exists "Family can view all albums" on public.albums;
create policy "Family can view all albums" on public.albums for select to authenticated using (true);
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
