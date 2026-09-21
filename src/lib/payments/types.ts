/**
 * Contracts of the payment decision engine.
 *
 * The engine is pure: it receives everything it needs as data and never
 * reads the clock, the database or the network. That is what makes every
 * decision reproducible from the audit log.
 */

export type Currency = 'EUR' | 'CHF'

/** The invoice fields the engine reads. A subset of `public.invoices`. */
export interface PayableInvoice {
  id: string
  status: string
  vendor_name: string | null
  vendor_tax_id: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  total_cents: number | null
  currency: string | null
  /** IBAN printed on the invoice, when the extraction found one. */
  payment_iban: string | null
  /** Creditor reference printed on the invoice (QRR, SCOR or free text). */
  payment_reference: string | null
}

export type AccountStatus = 'pending_verification' | 'verified' | 'rejected' | 'superseded'

/** Verification channels that do not depend on the (possibly forged) invoice or email. */
export type VerificationChannel = 'phone_callback' | 'in_person' | 'signed_letter' | 'bank_confirmation'

export interface SupplierAccount {
  id: string
  supplier_key: string
  supplier_name: string
  iban: string
  status: AccountStatus
  /** True when it replaced an earlier account of the same supplier. */
  is_change: boolean
  registered_at: string
  /** Set on verification of a change; payments wait until it has passed. */
  cooling_off_until: string | null
  verified_at: string | null
  verification_channel: VerificationChannel | null
}

export type PaymentState = 'in_batch' | 'paid'

/** Another invoice of the same user, for duplicate and anomaly checks. */
export interface HistoricInvoice {
  id: string
  supplier_key: string
  invoice_number: string | null
  invoice_date: string | null
  total_cents: number | null
  currency: string | null
  status: string
  payment_state: PaymentState | null
}

export interface EngineSettings {
  /** Amounts at or above this (in the invoice currency's cents) need a second look. */
  review_threshold_cents: number
  /** Hours a changed bank account stays blocked after it is verified. */
  cooling_off_hours: number
}

export const DEFAULT_SETTINGS: EngineSettings = {
  review_threshold_cents: 1_000_000, // 10 000.00
  cooling_off_hours: 72,
}

export interface Override {
  fingerprint: string
  note: string
  created_at: string
}

export interface DecisionContext {
  /** Today's date as YYYY-MM-DD in the user's business calendar. */
  today: string
  now: Date
  account: SupplierAccount | null
  history: readonly HistoricInvoice[]
  payment_state: PaymentState | null
  settings: EngineSettings
  override: Override | null
}

export type Outcome = 'pay' | 'review' | 'stop'
export type Severity = 'stop' | 'review' | 'info'

export type ReasonCode =
  // stop — must be resolved, cannot be waived
  | 'already_scheduled'
  | 'already_paid'
  | 'not_approved'
  | 'invoice_rejected'
  | 'amount_missing'
  | 'currency_unsupported'
  | 'no_bank_account'
  | 'account_unverified'
  | 'account_rejected'
  | 'account_cooling_off'
  | 'iban_mismatch'
  | 'account_iban_invalid'
  | 'duplicate_exact'
  | 'route_unsupported'
  | 'qr_iban_needs_qrr'
  | 'qrr_needs_qr_iban'
  // review — a person may accept it, with a note, for this exact evaluation
  | 'duplicate_probable'
  | 'amount_above_threshold'
  | 'amount_anomaly'
  | 'supplier_without_tax_id'
  // info — context, does not change the outcome
  | 'overdue'
  | 'no_due_date'

export type EvidenceValue = string | number

export interface Reason {
  code: ReasonCode
  severity: Severity
  /** Facts behind the reason, for the UI message and the audit trail. */
  evidence: Record<string, EvidenceValue>
}

export type PaymentRoute = 'sepa' | 'ch_domestic'

export interface PaymentPlan {
  route: PaymentRoute
  currency: Currency
  amount_cents: number
  creditor_name: string
  creditor_iban: string
  reference: { kind: 'QRR' | 'SCOR' | 'text'; value: string } | null
  requested_execution_date: string
}

export interface Decision {
  invoice_id: string
  outcome: Outcome
  reasons: Reason[]
  /** Hash of what a person would be accepting when overriding a review. */
  fingerprint: string
  /** True when a review was accepted by a person for this exact fingerprint. */
  overridden: boolean
  /** Present only when the outcome is `pay`. */
  plan: PaymentPlan | null
}
