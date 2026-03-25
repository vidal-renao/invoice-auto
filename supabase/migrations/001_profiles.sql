-- ============================================================
-- Migration: 001_profiles
-- Creates the profiles table, RLS policies, and triggers
-- ============================================================

-- Enable UUID extension (already available in Supabase, but safe to repeat)
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------
-- Table: profiles
-- Extends auth.users with app-specific user data
-- ----------------------------------------------------------
create table public.profiles (
  id            uuid        references auth.users(id) on delete cascade primary key,
  email         text        not null,
  full_name     text,
  company_name  text,
  tax_id        text,                          -- NIF (ES) or UID CHE-xxx.xxx.xxx (CH)
  country       text        not null default 'ES' check (country in ('ES', 'CH', 'DE')),
  locale        text        not null default 'es' check (locale in ('es', 'de', 'en')),
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'App-level user profile data, extends auth.users.';

-- ----------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles: owner can select"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "profiles: owner can update"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ----------------------------------------------------------
-- Index
-- ----------------------------------------------------------
create index profiles_email_idx on public.profiles (email);

-- ----------------------------------------------------------
-- Trigger: auto-create profile on new user signup
-- ----------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- ----------------------------------------------------------
-- Trigger: auto-update updated_at
-- ----------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute procedure public.set_updated_at();
