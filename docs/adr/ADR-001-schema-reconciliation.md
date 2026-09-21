# ADR-001 — Reconcile the migrations with the production schema

- **Status:** accepted · 2026-09-21
- **Migration:** `supabase/migrations/008_reconcile_live_schema.sql`

## Context

The production database had drifted from `supabase/migrations/`:

| In production, missing from the migrations | Used by |
|---|---|
| `invoices.due_date`, `client_name`, `client_email`, `client_phone`, `client_tax_id` | `src/lib/actions/ai.ts` writes them on every analysis |
| `vendors.phone` | `src/types/database.ts` |
| A `DELETE` policy on `invoices` (production had none) | `deleteInvoice()` |

A fresh clone that applied 001–007 would fail on the first analysed receipt.
Worse, in production `deleteInvoice()` deleted **zero rows without an error**
(RLS silently filters a DELETE with no policy) and then removed the receipt
from Storage: the invoice stayed, pointing at a file that no longer existed.

## Decision

1. One idempotent migration (`add column if not exists`, policy created only
   when no DELETE policy exists — checked by command, because production
   policies have hand-made names). Against production it is a no-op except
   for the DELETE policy; against a fresh database it completes the schema.
2. `deleteInvoice()` now asks for the deleted rows (`.select('id')`) and only
   touches Storage when a row was really deleted.
3. Every migration is replayed in CI-style tests (`supabase/tests/harness.ts`,
   PGlite with a minimal Supabase stub), so drift is caught by `npm test`.

## Consequences

- The repo is again the source of truth for the schema.
- `invoices.storage_path` and `profiles.role/plan` also exist only in
  production. They are not used by this app (`profiles` is shared with other
  apps in the same database), so they are deliberately left out.
