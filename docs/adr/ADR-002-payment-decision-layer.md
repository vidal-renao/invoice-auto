# ADR-002 — Payment decision layer

- **Status:** accepted · 2026-09-21
- **Code:** `src/lib/payments/`, `src/lib/actions/payments.ts`
- **Migration:** `supabase/migrations/009_payments.sql`

## Context

Invoice Auto already answers *"is this invoice correct?"* (extraction + VAT
validation + approval). A business then pays it — and that step is where
the expensive failures happen: paying twice, paying a changed IBAN that came
in a forged email (business email compromise), paying an amount nobody
looked at. The question this layer answers is different: *"is this payment
safe right now?"*

## Decision

### 1. A pure decision engine with three outcomes

`decide(invoice, context)` returns `pay`, `review` or `stop`, every reason
with its evidence, and a plan (route, account, execution date, reference)
when it is `pay`. It reads no clock, database or network: the same input
always gives the same decision, which is what makes it testable and
auditable.

| Outcome | Meaning | Examples |
|---|---|---|
| `stop` | Must be **resolved**, never waived | no/unverified/rejected account, cooling-off, IBAN on the invoice ≠ verified IBAN, exact duplicate, QR-IBAN without QR reference, not approved |
| `review` | A person may **accept** it, with a note | probable duplicate, four-eyes threshold, amount > 3× supplier median, supplier without tax id |
| `pay` | Goes into the next payment file | — |

An accepted review is bound to a SHA-256 **fingerprint** of what was
accepted (amount, currency, destination IBAN, reference, the exact set of
review reasons). Any change afterwards voids it.

### 2. The database re-checks what must never be wrong

The client can **read** `pay_*` tables but not write them (only `SELECT` is
granted). Every change goes through a `SECURITY DEFINER` function with an
empty `search_path` that:

1. takes the caller from `auth.uid()`, never from a parameter;
2. re-checks the invariant (account verified and out of cooling-off,
   invoice approved and owned, amount equal to the invoice);
3. writes the state **and** the audit entry in the same transaction.

A partial unique index (`pay_payments_one_open_per_invoice`) makes a double
payment impossible at the database level, whatever the application does.

Supabase's advisor flags these functions as "executable by authenticated".
That is intended: they are the only write path, and each one checks the
caller itself.

### 3. IBAN changes

A new or changed IBAN starts `pending_verification`. Verifying requires a
channel independent of the invoice (call-back to a known number, in person,
signed letter, bank confirmation) and records the contact used. A *changed*
IBAN then waits a cooling-off period (default 72 h, configurable 0–720 h)
before it can be paid, giving the real supplier time to notice. The IBAN
the extraction reads from an invoice is **evidence only**: payments always
go to the verified account, and a mismatch is a `stop`.

### 4. Output: ISO 20022 pain.001.001.09, no money movement

Both the EPC SEPA rulebook (2023+) and the Swiss Payment Standards
(SPS 2022+) use pain.001.001.09. The app generates the file; the user
uploads it to their e-banking. There is no bank connection, no stored
credentials and no licence requirement. Every generated file is validated
in tests against the official ISO XSD (`supabase/tests/fixtures/`).

Routes: EUR to any SEPA IBAN → SEPA (`SvcLvl SEPA`, `ChrgBr SLEV`); CHF to
CH/LI, or any payment to a QR-IBAN → Swiss domestic. Anything else is a
`stop` rather than a guess.

## Alternatives rejected

- **Writes from the server with the service-role key.** Simpler, but a bug
  in the app would bypass every invariant. RLS + definer functions keep the
  guarantees in the database.
- **Let a person override a `stop`.** The cases in `stop` are exactly the
  ones where "just this once" is how fraud succeeds.
- **Store the decision.** Decisions are recomputed on every view; only what
  a person did (accepted reviews, verifications, batches) is stored. A
  stored decision would go stale the moment an account or invoice changes.

## Retention (nDSG / Swiss CO)

`pay_audit_log` has no foreign key to the user on purpose: accounting
records must be kept for 10 years (Swiss CO art. 958f, Spanish Código de
Comercio art. 30: 6 years). It stores masked IBANs only (`ES91 •••• 1332`).
The other `pay_*` tables cascade with the user's profile. Deleting audit
entries after the retention period is an administrative operation outside
the app (the append-only trigger must be disabled deliberately by the
database owner).

## Known limits

- Bank holidays are not modelled; the bank shifts the execution date.
- Creditor postal addresses are not sent (they are not extracted yet). Name
  + IBAN is what the SEPA credit transfer requires; some banks and payment
  types in the Swiss standard also ask for a structured address — check the
  bank's SPS implementation guide before relying on the file there.
- One user = one company (no multi-tenant roles, so "four eyes" is a second
  look by the same user, recorded with a note).
