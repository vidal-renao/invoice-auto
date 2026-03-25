-- ============================================================
-- Migration: 002_invoices
-- Core invoices table — stores AI-extracted receipt data.
-- Data rules (data-architecture skill):
--   • Monetary amounts in INTEGER cents (ISO 4217 / no float errors)
--   • Dates stored in UTC (timestamptz / date)
--   • UUIDs for all primary keys
-- ============================================================

create table public.invoices (
  id               uuid        not null default uuid_generate_v4() primary key,
  user_id          uuid        not null references public.profiles(id) on delete cascade,

  -- ── Storage ──────────────────────────────────────────────────
  -- Path inside the `receipts` bucket: {user_id}/{uuid}.{ext}
  receipt_path     text,

  -- ── AI-extracted vendor data (nullable until processed) ──────
  vendor_name      text,
  vendor_tax_id    text,         -- NIF (ES) or UID CHE-xxx.xxx.xxx (CH)
  invoice_number   text,
  invoice_date     date,         -- Date on the receipt (UTC)

  -- ── Amounts (cents, integer) ─────────────────────────────────
  subtotal_cents   integer,      -- Base imponible
  tax_cents        integer,      -- Cuota IVA / VAT amount
  total_cents      integer,      -- Total including tax
  tax_rate         numeric(5,2), -- e.g. 21.00 | 10.00 | 4.00 | 8.10
  currency         text        not null default 'EUR'
                   check (currency in ('EUR', 'CHF')),

  -- ── Processing state ─────────────────────────────────────────
  status           text        not null default 'pending'
                   check (status in (
                     'pending',       -- Uploaded, not yet processed
                     'processing',    -- AI pipeline running
                     'review_needed', -- Low confidence — needs human review
                     'approved',      -- Verified and accepted
                     'rejected'       -- Discarded by user
                   )),

  -- ── AI metadata (ai-bridge skill) ────────────────────────────
  -- Confidence: 0.000 (none) → 1.000 (certain)
  ai_confidence    numeric(4,3) check (ai_confidence between 0 and 1),
  -- Full raw AI response stored for debugging / re-processing
  ai_raw_response  jsonb,

  -- ── User notes ───────────────────────────────────────────────
  notes            text,

  -- ── Audit ────────────────────────────────────────────────────
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.invoices is
  'Receipt/invoice records — one row per uploaded ticket. Amounts in cents.';

-- ── Row Level Security ────────────────────────────────────────
alter table public.invoices enable row level security;

create policy "invoices: owner select"
  on public.invoices for select
  using (auth.uid() = user_id);

create policy "invoices: owner insert"
  on public.invoices for insert
  with check (auth.uid() = user_id);

create policy "invoices: owner update"
  on public.invoices for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "invoices: owner delete"
  on public.invoices for delete
  using (auth.uid() = user_id);

-- ── Indexes (columns used in WHERE / ORDER BY) ────────────────
create index invoices_user_id_idx     on public.invoices (user_id);
create index invoices_status_idx      on public.invoices (status);
create index invoices_invoice_date_idx on public.invoices (invoice_date);
create index invoices_created_at_idx  on public.invoices (created_at desc);

-- ── updated_at trigger ────────────────────────────────────────
create trigger invoices_set_updated_at
  before update on public.invoices
  for each row
  execute procedure public.set_updated_at();
