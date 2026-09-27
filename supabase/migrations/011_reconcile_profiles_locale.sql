-- ============================================================
-- Migration: 010_profiles_locale
--
-- The settings page has always offered "interface language" and the server
-- action has always written `profiles.locale` — but the column never existed.
-- PostgREST answered every save with
--
--   Could not find the 'locale' column of 'profiles' in the schema cache
--
-- and the form showed "Error al guardar", losing the rest of the profile with
-- it: name, company and tax id are written in the same statement, so a user
-- could not save anything at all on that page.
--
-- Additive and idempotent: existing rows get the default.
-- ============================================================

alter table public.profiles
  add column if not exists locale text not null default 'es';

-- The application ships three locales; anything else would break the UI that
-- reads this value back.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_locale_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_locale_check check (locale in ('es', 'de', 'en'));
  end if;
end $$;

comment on column public.profiles.locale is
  'Interface language chosen in Settings: es, de or en.';
