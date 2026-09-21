import { createHash } from 'node:crypto'

import { diffDays, requestedExecutionDate } from './dates'
import { findDuplicates } from './duplicates'
import { checkIban, isQrIban, maskIban, normalizeIban } from './iban'
import { parseReference } from './reference'
import { supplierKey } from './supplier'
import type {
  Currency,
  Decision,
  DecisionContext,
  PayableInvoice,
  PaymentPlan,
  PaymentRoute,
  Reason,
} from './types'

/**
 * The payment decision engine.
 *
 * An approved invoice is a correct invoice; it is not yet a safe payment.
 * This function answers the second question for one invoice:
 *
 *   stop   — something must be fixed first (verify the account, reject the
 *            duplicate…). No person can waive it: it is resolved, not skipped.
 *   review — a person must look. They may accept it with a note, and that
 *            acceptance holds only for this exact evaluation (fingerprint).
 *   pay    — goes into the next payment file.
 *
 * Every reason carries its evidence, so the answer to "why was this held?"
 * is in the decision itself, not in someone's memory.
 */
export function decide(invoice: PayableInvoice, ctx: DecisionContext): Decision {
  const reasons: Reason[] = []
  const stop = (code: Reason['code'], evidence: Reason['evidence'] = {}) =>
    reasons.push({ code, severity: 'stop', evidence })
  const review = (code: Reason['code'], evidence: Reason['evidence'] = {}) =>
    reasons.push({ code, severity: 'review', evidence })
  const info = (code: Reason['code'], evidence: Reason['evidence'] = {}) =>
    reasons.push({ code, severity: 'info', evidence })

  // ── Already on its way ──────────────────────────────────────────
  if (ctx.payment_state === 'paid') stop('already_paid')
  else if (ctx.payment_state === 'in_batch') stop('already_scheduled')

  // ── The fiscal step must have accepted it ───────────────────────
  if (invoice.status === 'rejected') stop('invoice_rejected')
  else if (invoice.status !== 'approved') stop('not_approved', { status: invoice.status })

  // ── Amount and currency ─────────────────────────────────────────
  const amount = invoice.total_cents
  if (amount == null || amount <= 0) stop('amount_missing')

  const currency: Currency | null =
    invoice.currency === 'EUR' || invoice.currency === 'CHF' ? invoice.currency : null
  if (!currency) stop('currency_unsupported', { currency: invoice.currency ?? '—' })

  // ── Supplier identity ───────────────────────────────────────────
  const key = supplierKey(invoice.vendor_tax_id, invoice.vendor_name)
  if (key && !key.startsWith('tax:')) review('supplier_without_tax_id')

  // ── Bank account: registered, verified, out of cooling-off ──────
  const account = ctx.account
  const invoiceIban = invoice.payment_iban ? normalizeIban(invoice.payment_iban) : null
  let payableIban: string | null = null

  if (!account) {
    stop('no_bank_account', invoiceIban ? { invoice_iban: maskIban(invoiceIban) } : {})
  } else if (account.status === 'rejected') {
    stop('account_rejected', { iban: maskIban(account.iban) })
  } else if (account.status !== 'verified') {
    stop('account_unverified', {
      iban: maskIban(account.iban),
      registered_at: account.registered_at,
      is_change: account.is_change ? 1 : 0,
    })
  } else if (account.cooling_off_until && Date.parse(account.cooling_off_until) > ctx.now.getTime()) {
    stop('account_cooling_off', {
      iban: maskIban(account.iban),
      until: account.cooling_off_until,
    })
  } else {
    payableIban = normalizeIban(account.iban)
  }

  // The invoice asks to be paid somewhere else than the verified account:
  // the classic business-email-compromise pattern. Never follow the invoice.
  if (account && invoiceIban && normalizeIban(account.iban) !== invoiceIban) {
    stop('iban_mismatch', {
      invoice_iban: maskIban(invoiceIban),
      account_iban: maskIban(account.iban),
    })
  }

  // ── Route and reference (only meaningful with a usable account) ─
  const reference = parseReference(invoice.payment_reference)
  let route: PaymentRoute | null = null
  if (payableIban && currency) {
    const check = checkIban(payableIban)
    const country = check.valid ? check.country : payableIban.slice(0, 2)
    const swiss = country === 'CH' || country === 'LI'
    const qrIban = isQrIban(payableIban)

    // Accounts are validated when registered; this guards rows written by
    // any other path before an unpayable IBAN reaches the bank file.
    if (!check.valid) {
      stop('account_iban_invalid', { iban: maskIban(payableIban), problem: check.problem })
    } else if (qrIban && reference?.kind !== 'QRR') {
      stop('qr_iban_needs_qrr', { iban: maskIban(payableIban) })
    } else if (!qrIban && reference?.kind === 'QRR') {
      stop('qrr_needs_qr_iban', { iban: maskIban(payableIban) })
    } else if (swiss && (currency === 'CHF' || qrIban)) {
      route = 'ch_domestic'
    } else if (currency === 'EUR') {
      route = 'sepa'
    } else {
      stop('route_unsupported', { currency, country })
    }
  }

  // ── Duplicates ──────────────────────────────────────────────────
  if (key) {
    for (const match of findDuplicates(
      {
        id: invoice.id,
        supplier_key: key,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        total_cents: invoice.total_cents,
        currency: invoice.currency,
      },
      ctx.history,
    )) {
      const evidence = {
        other_id: match.other.id,
        other_number: match.other.invoice_number ?? '—',
        other_date: match.other.invoice_date ?? '—',
        other_state: match.other.payment_state ?? match.other.status,
      }
      if (match.kind === 'exact') stop('duplicate_exact', evidence)
      else review('duplicate_probable', evidence)
    }
  }

  // ── Amount: four-eyes threshold and supplier anomaly ────────────
  if (amount != null && amount > 0 && currency) {
    if (amount >= ctx.settings.review_threshold_cents) {
      review('amount_above_threshold', { threshold_cents: ctx.settings.review_threshold_cents })
    }
    if (key) {
      const anomaly = amountAnomaly(amount, currency, key, invoice.id, ctx)
      if (anomaly) review('amount_anomaly', anomaly)
    }
  }

  // ── Context ─────────────────────────────────────────────────────
  if (!invoice.due_date) info('no_due_date')
  else if (invoice.due_date < ctx.today) info('overdue', { days: diffDays(invoice.due_date, ctx.today) })

  // ── Outcome ─────────────────────────────────────────────────────
  const fingerprint = fingerprintOf(invoice, payableIban, reasons)
  const hasStop = reasons.some((r) => r.severity === 'stop')
  const hasReview = reasons.some((r) => r.severity === 'review')
  const overridden = !hasStop && hasReview && ctx.override?.fingerprint === fingerprint

  const outcome = hasStop ? 'stop' : hasReview && !overridden ? 'review' : 'pay'

  let plan: PaymentPlan | null = null
  if (outcome === 'pay' && route && payableIban && currency && amount != null && account) {
    plan = {
      route,
      currency,
      amount_cents: amount,
      creditor_name: account.supplier_name,
      creditor_iban: payableIban,
      reference: reference ? { kind: reference.kind, value: reference.value } : null,
      requested_execution_date: requestedExecutionDate(invoice.due_date, ctx.today),
    }
  }

  // A `pay` without a plan would be a bug in the rules above; refuse it loudly.
  if (outcome === 'pay' && !plan) {
    throw new Error(`Invariant: invoice ${invoice.id} is payable but has no payment plan`)
  }

  return { invoice_id: invoice.id, outcome, reasons, fingerprint, overridden, plan }
}

/** Needs a history of at least this many invoices before calling anything unusual. */
export const ANOMALY_MIN_HISTORY = 3
/** "Unusual" means above this multiple of the supplier's median amount. */
export const ANOMALY_FACTOR = 3

function amountAnomaly(
  amount: number,
  currency: Currency,
  key: string,
  invoiceId: string,
  ctx: DecisionContext,
): Reason['evidence'] | null {
  const amounts = ctx.history
    .filter(
      (h) =>
        h.id !== invoiceId &&
        h.supplier_key === key &&
        h.currency === currency &&
        h.status !== 'rejected' &&
        h.total_cents != null &&
        h.total_cents > 0,
    )
    .map((h) => h.total_cents!)
    .sort((a, b) => a - b)

  if (amounts.length < ANOMALY_MIN_HISTORY) return null

  const mid = Math.floor(amounts.length / 2)
  const median =
    amounts.length % 2 === 1 ? amounts[mid]! : Math.round((amounts[mid - 1]! + amounts[mid]!) / 2)
  if (amount <= median * ANOMALY_FACTOR) return null

  return {
    median_cents: median,
    factor: Math.round((amount / median) * 10) / 10,
    sample: amounts.length,
  }
}

/**
 * What a person accepts when they override a review: the amount, where the
 * money goes, the reference, and the exact set of review reasons. If any of
 * them changes afterwards, the acceptance no longer applies.
 */
function fingerprintOf(invoice: PayableInvoice, iban: string | null, reasons: Reason[]): string {
  const reviewed = reasons
    .filter((r) => r.severity === 'review')
    .map((r) => `${r.code}:${JSON.stringify(r.evidence, Object.keys(r.evidence).sort())}`)
    .sort()
  const payload = JSON.stringify({
    invoice: invoice.id,
    amount: invoice.total_cents,
    currency: invoice.currency,
    iban,
    reference: invoice.payment_reference?.trim() ?? null,
    reviewed,
  })
  return createHash('sha256').update(payload).digest('hex')
}
