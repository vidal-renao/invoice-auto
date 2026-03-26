-- ============================================================
-- Migration: 006_vendors
-- Creates the vendors table (supplier / vendor directory)
-- Vendors are detected automatically from analyzed invoices and
-- can be enriched with category, email, website, and notes.
-- ============================================================

-- ----------------------------------------------------------
-- Table: vendors
-- ----------------------------------------------------------
create table if not exists public.vendors (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  name         text        not null,
  tax_id       text,                                          -- NIF / CIF / UID / VAT number
  country_code text        check (country_code is null or length(country_code) = 2),
  category     text        check (
                             category is null or
                             category in ('software','utilities','travel','marketing','professional','office','other')
                           ),
  email        text,
  website      text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.vendors is 'Vendor / supplier directory. Populated automatically from analyzed invoice data; enrichable with category and contact fields.';
comment on column public.vendors.tax_id       is 'Vendor tax identification number (NIF, CIF, UID, VAT). Matches invoices.vendor_tax_id for auto-linking.';
comment on column public.vendors.country_code is 'ISO 3166-1 alpha-2 country code of the vendor.';
comment on column public.vendors.category     is 'Expense category for reporting: software, utilities, travel, marketing, professional, office, other.';

-- ----------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------
alter table public.vendors enable row level security;

create policy "vendors: owner can select"
  on public.vendors for select
  using (auth.uid() = user_id);

create policy "vendors: owner can insert"
  on public.vendors for insert
  with check (auth.uid() = user_id);

create policy "vendors: owner can update"
  on public.vendors for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "vendors: owner can delete"
  on public.vendors for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------
create index if not exists vendors_user_id_idx   on public.vendors (user_id);
create index if not exists vendors_name_idx      on public.vendors (user_id, name);
create index if not exists vendors_tax_id_idx    on public.vendors (user_id, tax_id);

-- ----------------------------------------------------------
-- Trigger: auto-update updated_at
-- (reuses the set_updated_at function created in 001_profiles)
-- ----------------------------------------------------------
create trigger vendors_set_updated_at
  before update on public.vendors
  for each row
  execute procedure public.set_updated_at();
