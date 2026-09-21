import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateXML } from 'xmllint-wasm'

import { businessToday } from './dates'
import { buildDemoPaymentFile, buildDemoWorkspace, DEMO_DEBTOR } from './demo'
import { checkIban } from './iban'
import { buildQueue } from './queue'
import type { ReasonCode } from './types'

// A Monday, a Saturday and a day in another month: the demo must hold on any day.
const DAYS = ['2026-09-21T08:00:00Z', '2026-09-26T08:00:00Z', '2027-01-04T08:00:00Z']

describe.each(DAYS)('demo workspace on %s', (iso) => {
  const now = new Date(iso)
  const today = businessToday(now)
  const ws = buildDemoWorkspace(now, today)
  const queue = buildQueue(ws, now, today)
  const all = [...queue.pay, ...queue.review, ...queue.stop]
  const codes = new Set<ReasonCode>(all.flatMap((q) => q.decision.reasons.map((r) => r.code)))

  it('uses only IBANs that pass the checksum', () => {
    for (const a of ws.accounts) expect(checkIban(a.iban).valid, a.iban).toBe(true)
    for (const i of ws.invoices) if (i.payment_iban) expect(checkIban(i.payment_iban).valid).toBe(true)
    expect(checkIban(DEMO_DEBTOR.iban).valid).toBe(true)
  })

  it('exercises every outcome', () => {
    expect(queue.pay.length).toBe(3)
    expect(queue.review.length).toBe(4)
    expect(queue.stop.length).toBe(6)
    expect(queue.settled.length).toBe(4)
    expect(queue.awaiting_approval).toBe(1)
  })

  it('shows the fraud and control patterns it is meant to show', () => {
    for (const code of [
      'iban_mismatch',
      'account_cooling_off',
      'account_unverified',
      'duplicate_exact',
      'duplicate_probable',
      'amount_anomaly',
      'no_bank_account',
      'supplier_without_tax_id',
      'qr_iban_needs_qrr',
    ] as const) {
      expect(codes.has(code), code).toBe(true)
    }
  })

  it('pays one invoice through an accepted review, and the SEPA and Swiss routes', () => {
    expect(queue.pay.some((q) => q.decision.overridden)).toBe(true)
    expect(new Set(queue.pay.map((q) => q.decision.plan?.route))).toEqual(new Set(['sepa', 'ch_domestic']))
  })
})

describe('demo payment file', () => {
  it('is valid against the official ISO 20022 schema and contains exactly the payable invoices', async () => {
    const now = new Date('2026-09-21T08:00:00Z')
    const xml = buildDemoPaymentFile(now, businessToday(now))
    const xsd = readFileSync(join(__dirname, '../../../supabase/tests/fixtures/pain.001.001.09.xsd'), 'utf8')
    const result = await validateXML({
      xml: { fileName: 'demo.xml', contents: xml },
      schema: { fileName: 'pain.001.001.09.xsd', contents: xsd },
    })
    expect(result.errors).toEqual([])
    expect(xml).toContain('<NbOfTxs>3</NbOfTxs>')
    // 242.00 EUR + 318.40 CHF + 12400.00 EUR
    expect(xml).toContain('<CtrlSum>12960.40</CtrlSum>')
    expect(xml).not.toContain('Transportes Ebro')
  })
})
