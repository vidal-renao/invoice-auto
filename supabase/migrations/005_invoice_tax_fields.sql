-- Migration 005: Multi-country tax intelligence fields
-- Adds country_code, is_reverse_charge, and tax_validation_status to the invoices table.

-- ── Country of origin (ISO 3166-1 alpha-2) ──────────────────────────────────
alter table public.invoices
  add column if not exists country_code text
    check (country_code is null or length(country_code) = 2);

-- ── Reverse charge / Inversión del Sujeto Pasivo flag ───────────────────────
alter table public.invoices
  add column if not exists is_reverse_charge boolean not null default false;

-- ── Tax math validation result ───────────────────────────────────────────────
-- 'valid'       — extracted VAT matches a known legal rate for that country
-- 'discrepancy' — extracted VAT does not match any legal rate (flag for review)
-- 'unknown'     — insufficient data to validate (default)
alter table public.invoices
  add column if not exists tax_validation_status text
    check (
      tax_validation_status is null
      or tax_validation_status in ('valid', 'discrepancy', 'unknown')
    )
    default 'unknown';

-- ── Indexes for CFO dashboard queries ───────────────────────────────────────
-- Group by country + filter by quarter
create index if not exists invoices_country_code_idx
  on public.invoices (user_id, country_code);

-- Date-based quarter grouping
create index if not exists invoices_invoice_date_idx
  on public.invoices (user_id, invoice_date);
