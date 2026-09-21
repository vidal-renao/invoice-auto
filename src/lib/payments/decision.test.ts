import { describe, expect, it } from 'vitest'

import { decide } from './decision'
import {
  DEFAULT_SETTINGS,
  type DecisionContext,
  type HistoricInvoice,
  type PayableInvoice,
  type ReasonCode,
  type SupplierAccount,
} from './types'

const NOW = new Date('2026-09-21T09:00:00Z')

function invoice(over: Partial<PayableInvoice> = {}): PayableInvoice {
  return {
    id: 'inv-1',
    status: 'approved',
    vendor_name: 'Acme SL',
    vendor_tax_id: 'ESB12345678',
    invoice_number: 'F-2026-117',
    invoice_date: '2026-09-10',
    due_date: '2026-09-30',
    total_cents: 121_000,
    currency: 'EUR',
    payment_iban: null,
    payment_reference: null,
    ...over,
  }
}

function account(over: Partial<SupplierAccount> = {}): SupplierAccount {
  return {
    id: 'acc-1',
    supplier_key: 'tax:B12345678',
    supplier_name: 'Acme SL',
    iban: 'ES9121000418450200051332',
    status: 'verified',
    is_change: false,
    registered_at: '2026-01-10T10:00:00Z',
    cooling_off_until: null,
    verified_at: '2026-01-10T12:00:00Z',
    verification_channel: 'phone_callback',
    ...over,
  }
}

function ctx(over: Partial<DecisionContext> = {}): DecisionContext {
  return {
    today: '2026-09-21',
    now: NOW,
    account: account(),
    history: [],
    payment_state: null,
    settings: DEFAULT_SETTINGS,
    override: null,
    ...over,
  }
}

function hist(over: Partial<HistoricInvoice>): HistoricInvoice {
  return {
    id: 'h',
    supplier_key: 'tax:B12345678',
    invoice_number: 'X',
    invoice_date: '2026-01-01',
    total_cents: 100_000,
    currency: 'EUR',
    status: 'approved',
    payment_state: 'paid',
    ...over,
  }
}

const codes = (d: { reasons: { code: ReasonCode; severity: string }[] }, severity?: string) =>
  d.reasons.filter((r) => !severity || r.severity === severity).map((r) => r.code)

describe('decide — the clean path', () => {
  it('pays an approved invoice to a verified account, on its due date, via SEPA', () => {
    const d = decide(invoice(), ctx())
    expect(d.outcome).toBe('pay')
    expect(d.reasons).toEqual([])
    expect(d.plan).toEqual({
      route: 'sepa',
      currency: 'EUR',
      amount_cents: 121_000,
      creditor_name: 'Acme SL',
      creditor_iban: 'ES9121000418450200051332',
      reference: null,
      requested_execution_date: '2026-09-30',
    })
  })

  it('pays a Swiss CHF invoice to a QR-IBAN with its QR reference, domestically', () => {
    const d = decide(
      invoice({ currency: 'CHF', vendor_tax_id: 'CHE-123.456.789', payment_reference: '210000000003139471430009017' }),
      ctx({ account: account({ supplier_key: 'tax:CHE123456789', iban: 'CH4431999123000889012' }) }),
    )
    expect(d.outcome).toBe('pay')
    expect(d.plan).toMatchObject({ route: 'ch_domestic', reference: { kind: 'QRR' } })
  })

  it('pays EUR to a Swiss normal IBAN through SEPA', () => {
    const d = decide(invoice(), ctx({ account: account({ iban: 'CH9300762011623852957' }) }))
    expect(d.plan?.route).toBe('sepa')
  })

  it('notes an overdue invoice without holding it', () => {
    const d = decide(invoice({ due_date: '2026-09-11' }), ctx())
    expect(d.outcome).toBe('pay')
    expect(d.reasons).toEqual([{ code: 'overdue', severity: 'info', evidence: { days: 10 } }])
    expect(d.plan?.requested_execution_date).toBe('2026-09-21')
  })
})

describe('decide — stop: resolved, never waived', () => {
  it.each([
    ['review_needed', 'not_approved'],
    ['processing', 'not_approved'],
    ['rejected', 'invoice_rejected'],
  ] as const)('invoice status %s → %s', (status, code) => {
    const d = decide(invoice({ status }), ctx())
    expect(d.outcome).toBe('stop')
    expect(codes(d, 'stop')).toContain(code)
  })

  it('stops what is already paid or already in a payment file', () => {
    expect(codes(decide(invoice(), ctx({ payment_state: 'paid' })))).toContain('already_paid')
    expect(codes(decide(invoice(), ctx({ payment_state: 'in_batch' })))).toContain('already_scheduled')
  })

  it('stops a missing or non-positive amount', () => {
    expect(codes(decide(invoice({ total_cents: null }), ctx()))).toContain('amount_missing')
    expect(codes(decide(invoice({ total_cents: 0 }), ctx()))).toContain('amount_missing')
  })

  it('stops when the supplier has no bank account, pointing at the IBAN the invoice printed', () => {
    const d = decide(invoice({ payment_iban: 'ES91 2100 0418 4502 0005 1332' }), ctx({ account: null }))
    expect(d.reasons).toContainEqual({
      code: 'no_bank_account',
      severity: 'stop',
      evidence: { invoice_iban: 'ES91 •••• 1332' },
    })
  })

  it('stops an unverified account', () => {
    const d = decide(invoice(), ctx({ account: account({ status: 'pending_verification', verified_at: null }) }))
    expect(codes(d, 'stop')).toEqual(['account_unverified'])
  })

  it('stops a changed account during its cooling-off period, and pays once it has passed', () => {
    const changed = account({ is_change: true, cooling_off_until: '2026-09-23T12:00:00Z' })
    expect(codes(decide(invoice(), ctx({ account: changed })), 'stop')).toEqual(['account_cooling_off'])

    const later = ctx({ account: changed, now: new Date('2026-09-23T12:00:01Z'), today: '2026-09-23' })
    expect(decide(invoice(), later).outcome).toBe('pay')
  })

  it('stops a rejected account', () => {
    expect(codes(decide(invoice(), ctx({ account: account({ status: 'rejected' }) })))).toContain('account_rejected')
  })

  it('stops when the invoice asks for payment to a different IBAN than the verified one', () => {
    const d = decide(invoice({ payment_iban: 'DE89 3704 0044 0532 0130 00' }), ctx())
    expect(d.outcome).toBe('stop')
    expect(d.reasons).toContainEqual({
      code: 'iban_mismatch',
      severity: 'stop',
      evidence: { invoice_iban: 'DE89 •••• 3000', account_iban: 'ES91 •••• 1332' },
    })
    expect(d.plan).toBeNull()
  })

  it('does not stop when the invoice prints the verified IBAN in another format', () => {
    expect(decide(invoice({ payment_iban: 'es91 2100 0418 4502 0005 1332' }), ctx()).outcome).toBe('pay')
  })

  it('stops an exact duplicate, naming the invoice it duplicates', () => {
    const paid = hist({ id: 'inv-0', invoice_number: 'F2026117', invoice_date: '2026-09-09' })
    const d = decide(invoice(), ctx({ history: [paid] }))
    expect(d.reasons).toContainEqual({
      code: 'duplicate_exact',
      severity: 'stop',
      evidence: { other_id: 'inv-0', other_number: 'F2026117', other_date: '2026-09-09', other_state: 'paid' },
    })
  })

  it('stops a QR-IBAN without a QR reference, and a QR reference to a normal IBAN', () => {
    const qr = account({ iban: 'CH4431999123000889012' })
    expect(codes(decide(invoice({ currency: 'CHF' }), ctx({ account: qr })))).toContain('qr_iban_needs_qrr')

    const normal = account({ iban: 'CH9300762011623852957' })
    const withQrr = invoice({ currency: 'CHF', payment_reference: '210000000003139471430009017' })
    expect(codes(decide(withQrr, ctx({ account: normal })))).toContain('qrr_needs_qr_iban')
  })

  it('stops CHF to an account outside Switzerland and Liechtenstein', () => {
    const d = decide(invoice({ currency: 'CHF' }), ctx())
    expect(d.reasons).toContainEqual({
      code: 'route_unsupported',
      severity: 'stop',
      evidence: { currency: 'CHF', country: 'ES' },
    })
  })

  it('stops an account whose stored IBAN is invalid instead of sending it to the bank', () => {
    const bad = account({ iban: 'ES9121000418450200051333' })
    expect(codes(decide(invoice(), ctx({ account: bad })))).toContain('account_iban_invalid')
  })

  it('reports every problem at once, not only the first', () => {
    const d = decide(
      invoice({ status: 'review_needed', payment_iban: 'DE89370400440532013000' }),
      ctx({ account: account({ status: 'pending_verification' }) }),
    )
    expect(codes(d, 'stop')).toEqual(['not_approved', 'account_unverified', 'iban_mismatch'])
  })

  it('cannot be overridden: an acceptance for a stopped invoice changes nothing', () => {
    const stopped = decide(invoice(), ctx({ account: null }))
    const again = decide(
      invoice(),
      ctx({ account: null, override: { fingerprint: stopped.fingerprint, note: 'ok', created_at: '' } }),
    )
    expect(again.outcome).toBe('stop')
    expect(again.overridden).toBe(false)
  })
})

describe('decide — review: a person looks, and may accept', () => {
  it('reviews a probable duplicate', () => {
    const sibling = hist({ id: 'inv-9', invoice_number: 'F-2026-116', invoice_date: '2026-09-08', total_cents: 121_000, payment_state: null })
    expect(codes(decide(invoice(), ctx({ history: [sibling] })), 'review')).toEqual(['duplicate_probable'])
  })

  it('reviews amounts at or above the four-eyes threshold', () => {
    const d = decide(invoice({ total_cents: 1_000_000 }), ctx())
    expect(d.reasons).toContainEqual({
      code: 'amount_above_threshold',
      severity: 'review',
      evidence: { threshold_cents: 1_000_000 },
    })
  })

  it('reviews an amount far above what this supplier usually bills', () => {
    const usual = [90_000, 100_000, 110_000].map((c, i) => hist({ id: `h${i}`, invoice_number: `H${i}`, total_cents: c }))
    const d = decide(invoice({ total_cents: 400_000 }), ctx({ history: usual }))
    expect(d.reasons).toContainEqual({
      code: 'amount_anomaly',
      severity: 'review',
      evidence: { median_cents: 100_000, factor: 4, sample: 3 },
    })
  })

  it('does not call anything unusual on a short history', () => {
    const two = [100_000, 100_000].map((c, i) => hist({ id: `h${i}`, invoice_number: `H${i}`, total_cents: c }))
    expect(codes(decide(invoice({ total_cents: 900_000 }), ctx({ history: two })))).not.toContain('amount_anomaly')
  })

  it('reviews a supplier identified by name only', () => {
    const d = decide(
      invoice({ vendor_tax_id: null }),
      ctx({ account: account({ supplier_key: 'name:acme' }) }),
    )
    expect(codes(d, 'review')).toEqual(['supplier_without_tax_id'])
  })

  it('pays a review once a person accepted this exact evaluation', () => {
    const big = invoice({ total_cents: 2_000_000 })
    const first = decide(big, ctx())
    expect(first.outcome).toBe('review')

    const accepted = decide(big, ctx({ override: { fingerprint: first.fingerprint, note: 'Contrato anual', created_at: '' } }))
    expect(accepted.outcome).toBe('pay')
    expect(accepted.overridden).toBe(true)
    expect(accepted.plan?.amount_cents).toBe(2_000_000)
  })

  it('voids the acceptance when the amount changes afterwards', () => {
    const first = decide(invoice({ total_cents: 2_000_000 }), ctx())
    const changed = decide(
      invoice({ total_cents: 2_500_000 }),
      ctx({ override: { fingerprint: first.fingerprint, note: 'ok', created_at: '' } }),
    )
    expect(changed.outcome).toBe('review')
    expect(changed.overridden).toBe(false)
  })

  it('voids the acceptance when a new review reason appears', () => {
    const big = invoice({ total_cents: 2_000_000 })
    const first = decide(big, ctx())
    const sibling = hist({ id: 'inv-9', invoice_number: 'OTHER', invoice_date: '2026-09-12', total_cents: 2_000_000, payment_state: null })
    const later = decide(big, ctx({ history: [sibling], override: { fingerprint: first.fingerprint, note: 'ok', created_at: '' } }))
    expect(later.outcome).toBe('review')
  })

  it('voids the acceptance when the destination account changes', () => {
    const big = invoice({ total_cents: 2_000_000 })
    const first = decide(big, ctx())
    const moved = decide(
      big,
      ctx({
        account: account({ iban: 'DE89370400440532013000' }),
        override: { fingerprint: first.fingerprint, note: 'ok', created_at: '' },
      }),
    )
    expect(moved.outcome).toBe('review')
  })

  it('is deterministic: the same input gives the same fingerprint', () => {
    expect(decide(invoice(), ctx()).fingerprint).toBe(decide(invoice(), ctx()).fingerprint)
  })
})
