# Threat model — payments

Scope: the payment decision layer (ADR-002). Assets: the money of the user's
company, supplier bank details (third-party data), the audit trail.

| # | Threat | Vector | Control | Where |
|---|---|---|---|---|
| T1 | **Bank-detail change fraud (BEC)** | Forged invoice or email with a new IBAN | Printed IBAN is evidence only; mismatch with the verified account = `stop`; new/changed IBAN must be verified out-of-band, with the contact recorded; changed IBAN waits a cooling-off period | `decision.ts`, `pay_verify_account` |
| T2 | **Duplicate payment** | Same invoice uploaded twice, number read differently, re-sent invoice | Exact duplicate = `stop`, probable = `review`; normalised numbers and supplier keys; unique index on open payments per invoice | `duplicates.ts`, `pay_payments_one_open_per_invoice` |
| T3 | **Altered amount** | Invoice amount inflated, or changed after a review was accepted | Supplier median anomaly; four-eyes threshold; acceptance bound to a fingerprint that includes the amount; DB checks amount = invoice total | `decision.ts`, `pay_create_batch` |
| T4 | **App bug schedules a held payment** | Stale screen, race, logic error | Server re-decides every invoice before building a file; DB re-checks verification, cooling-off, approval and amount | `createPaymentBatch`, `pay_create_batch` |
| T5 | **Cross-tenant access** | Guessing ids through the API | RLS on every `pay_*` table; functions filter by `auth.uid()`; client has `SELECT` only | `009_payments.sql` |
| T6 | **Tampering with the audit trail** | UPDATE/DELETE/TRUNCATE on `pay_audit_log` | No write grants; triggers reject all three even for the table owner | `pay_audit_immutable` |
| T7 | **Leaking account numbers** | Screenshots, audit exports, logs | Audit log stores masked IBANs; queue shows masked IBANs; full IBAN only on the accounts screen, where it has to be read out to verify it | `maskIban`, `pay_mask_iban` |
| T8 | **Invalid file reaches the bank** | Malformed XML, bad IBAN, duplicate ids | IBAN MOD-97 in app and DB; QR-IBAN/QRR rules; ids and lengths validated; generated XML validated against the official XSD in tests | `pain001.ts`, `pain001.test.ts` |
| T9 | **SQL injection / search_path hijack** | Crafted parameters, objects in another schema | Parameterised calls only; definer functions use `set search_path = ''` and schema-qualified names | `009_payments.sql` |

## Out of scope

- Compromise of the user's own account (session theft): mitigated by
  Supabase Auth, not by this layer. A stolen session can do what the user
  can do, but cannot bypass T1–T4 or erase T6.
- Execution at the bank: the app never holds bank credentials.
