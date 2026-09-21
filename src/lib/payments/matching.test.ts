import { describe, expect, it } from 'vitest'

import { addDays, diffDays, isWeekend, requestedExecutionDate } from './dates'
import { findDuplicates, normalizeInvoiceNumber } from './duplicates'
import { normalizeSupplierName, normalizeTaxId, supplierKey } from './supplier'
import type { HistoricInvoice } from './types'

describe('supplier identity', () => {
  it('treats the Spanish VAT prefix and punctuation as the same NIF', () => {
    expect(normalizeTaxId('ESB12345678')).toBe('B12345678')
    expect(normalizeTaxId('b-1234567-8')).toBe('B12345678')
    expect(normalizeTaxId('ES B12345678')).toBe('B12345678')
  })

  it('normalises a Swiss UID with or without the VAT suffix', () => {
    expect(normalizeTaxId('CHE-123.456.789 MWST')).toBe('CHE123456789')
    expect(normalizeTaxId('CHE-123.456.789')).toBe('CHE123456789')
  })

  it('leaves other EU VAT numbers intact', () => {
    expect(normalizeTaxId('DE123456789')).toBe('DE123456789')
  })

  it('ignores accents, case, punctuation and the legal form in names', () => {
    expect(normalizeSupplierName('Müller & Söhne AG')).toBe('mullersohne')
    expect(normalizeSupplierName('MULLER SOHNE')).toBe('mullersohne')
    expect(normalizeSupplierName('ACME, S.L.')).toBe('acme')
    expect(normalizeSupplierName('Acme SL')).toBe('acme')
  })

  it('prefers the tax id and falls back to the name', () => {
    expect(supplierKey('ESB12345678', 'Acme SL')).toBe('tax:B12345678')
    expect(supplierKey(null, 'Acme SL')).toBe('name:acme')
    expect(supplierKey('123', 'Acme SL')).toBe('name:acme')
    expect(supplierKey(null, null)).toBeNull()
  })
})

describe('invoice numbers', () => {
  it('strips separators and leading zeros per segment', () => {
    expect(normalizeInvoiceNumber('F-0012')).toBe('F12')
    expect(normalizeInvoiceNumber('f 12')).toBe('F12')
    expect(normalizeInvoiceNumber('2024/001')).toBe('20241')
    expect(normalizeInvoiceNumber('2024-1')).toBe('20241')
  })

  it('keeps zeros that are part of the number', () => {
    expect(normalizeInvoiceNumber('2024001')).toBe('2024001')
    expect(normalizeInvoiceNumber('F100')).toBe('F100')
    expect(normalizeInvoiceNumber('0')).toBe('0')
  })

  it('is empty for missing numbers so they never match each other', () => {
    expect(normalizeInvoiceNumber(null)).toBe('')
    expect(normalizeInvoiceNumber(' - ')).toBe('')
  })
})

function hist(over: Partial<HistoricInvoice>): HistoricInvoice {
  return {
    id: 'other',
    supplier_key: 'tax:B12345678',
    invoice_number: 'F-001',
    invoice_date: '2026-09-01',
    total_cents: 12_100,
    currency: 'EUR',
    status: 'approved',
    payment_state: null,
    ...over,
  }
}

const candidate = {
  id: 'me',
  supplier_key: 'tax:B12345678',
  invoice_number: 'F-001',
  invoice_date: '2026-09-01',
  total_cents: 12_100,
  currency: 'EUR',
}

describe('duplicates', () => {
  it('flags the same number from the same supplier as exact, whatever the amount', () => {
    expect(findDuplicates(candidate, [hist({})])).toMatchObject([{ kind: 'exact' }])
    expect(findDuplicates(candidate, [hist({ invoice_number: 'F1', total_cents: 99 })])).toMatchObject([
      { kind: 'exact' },
    ])
  })

  it('flags same supplier + amount within a week as probable', () => {
    const other = hist({ invoice_number: 'F-777', invoice_date: '2026-09-06' })
    expect(findDuplicates(candidate, [other])).toMatchObject([{ kind: 'probable' }])
  })

  it('does not flag a monthly subscription of the same amount', () => {
    const lastMonth = hist({ invoice_number: 'F-000', invoice_date: '2026-08-01' })
    expect(findDuplicates(candidate, [lastMonth])).toEqual([])
  })

  it('flags the same number and amount under a differently read supplier', () => {
    const other = hist({ supplier_key: 'name:acme', invoice_date: '2026-05-01' })
    expect(findDuplicates(candidate, [other])).toMatchObject([{ kind: 'probable' }])
  })

  it('ignores itself and rejected invoices', () => {
    expect(findDuplicates(candidate, [hist({ id: 'me' }), hist({ status: 'rejected' })])).toEqual([])
  })

  it('does not match two invoices that both lack a number', () => {
    const noNumber = { ...candidate, invoice_number: null }
    const other = hist({ invoice_number: null, invoice_date: '2026-06-01' })
    expect(findDuplicates(noNumber, [other])).toEqual([])
  })

  it('does not treat the same amount in another currency as a match', () => {
    const other = hist({ invoice_number: 'F-777', currency: 'CHF' })
    expect(findDuplicates(candidate, [other])).toEqual([])
  })
})

describe('execution date', () => {
  // 2026-09-21 is a Monday.
  it('knows the weekend', () => {
    expect(isWeekend('2026-09-26')).toBe(true)
    expect(isWeekend('2026-09-27')).toBe(true)
    expect(isWeekend('2026-09-28')).toBe(false)
  })

  it('pays on a future due date that is a business day', () => {
    expect(requestedExecutionDate('2026-09-30', '2026-09-21')).toBe('2026-09-30')
  })

  it('moves a weekend due date to the Friday before, never after', () => {
    expect(requestedExecutionDate('2026-09-27', '2026-09-21')).toBe('2026-09-25')
  })

  it('pays overdue or undated invoices on the next business day from today', () => {
    expect(requestedExecutionDate('2026-09-01', '2026-09-21')).toBe('2026-09-21')
    expect(requestedExecutionDate(null, '2026-09-26')).toBe('2026-09-28')
  })

  it('never asks for a date in the past, even when the Friday before has passed', () => {
    // Due Sunday, today Saturday: Friday is gone, so the next business day.
    expect(requestedExecutionDate('2026-09-27', '2026-09-26')).toBe('2026-09-28')
  })

  it('does date arithmetic across month and year boundaries in UTC', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(diffDays('2026-02-27', '2026-03-01')).toBe(2)
  })
})
