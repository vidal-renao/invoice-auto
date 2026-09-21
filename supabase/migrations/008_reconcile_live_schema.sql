-- ============================================================
-- Migration: 008_reconcile_live_schema
--
-- The production database drifted from this folder: columns were added
-- by hand and never captured as migrations. The app writes to them
-- (src/lib/actions/ai.ts), so a fresh clone that applies 001–007 breaks
-- on the first analysed receipt.
--
-- Everything here is idempotent. Against production it is a no-op for the
-- columns and only adds what is genuinely missing there: a DELETE policy.
-- Without it, deleteInvoice() deleted zero rows without an error and then
-- removed the receipt from Storage — an invoice pointing at a missing file.
-- ============================================================

-- ── Columns written by the extraction pipeline ────────────────
alter table public.invoices add column if not exists due_date      date;
alter table public.invoices add column if not exists client_name   text;
alter table public.invoices add column if not exists client_email  text;
alter table public.invoices add column if not exists client_phone  text;
alter table public.invoices add column if not exists client_tax_id text;

comment on column public.invoices.due_date is 'Payment due date printed on the document (UTC day). Null when not stated.';

alter table public.vendors add column if not exists phone text;

-- ── DELETE policy ─────────────────────────────────────────────
-- Checked by command, not by name: production policies were created by
-- hand with different names than 002_invoices uses.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoices' and cmd = 'DELETE'
  ) then
    create policy "invoices: owner delete"
      on public.invoices for delete
      using (auth.uid() = user_id);
  end if;
end
$$;
