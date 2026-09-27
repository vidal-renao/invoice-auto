import { describe, expect, it } from 'vitest'
import { applyInvoiceFilters } from './filters'

/**
 * The filters are the one place in the list where a wrong rule is invisible:
 * the page simply shows fewer rows, and the user concludes "the filter does not
 * work". This records what each filter is supposed to send to PostgREST.
 */
interface Llamada {
  metodo: string
  argumentos: unknown[]
}

function consultaFalsa() {
  const llamadas: Llamada[] = []
  const q: Record<string, unknown> = {}
  for (const metodo of ['eq', 'ilike', 'gte', 'lte', 'or', 'is']) {
    q[metodo] = (...argumentos: unknown[]) => {
      llamadas.push({ metodo, argumentos })
      return q
    }
  }
  return { q, llamadas }
}

describe('applyInvoiceFilters', () => {
  it('does nothing without filters', () => {
    const { q, llamadas } = consultaFalsa()
    applyInvoiceFilters(q)
    expect(llamadas).toEqual([])
  })

  it('matches status and currency exactly, and the vendor by substring', () => {
    const { q, llamadas } = consultaFalsa()
    applyInvoiceFilters(q, { status: 'approved', currency: 'CHF', vendor: 'alpen' })
    expect(llamadas).toEqual([
      { metodo: 'eq', argumentos: ['status', 'approved'] },
      { metodo: 'eq', argumentos: ['currency', 'CHF'] },
      { metodo: 'ilike', argumentos: ['vendor_name', '%alpen%'] },
    ])
  })

  it('falls back to the upload date when the invoice date is unknown', () => {
    const { q, llamadas } = consultaFalsa()
    applyInvoiceFilters(q, { dateFrom: '2026-09-01' })

    // The old rule was gte('invoice_date', …), which hid every failed
    // extraction because that column is null there.
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0]!.metodo).toBe('or')
    const expresion = String(llamadas[0]!.argumentos[0])
    expect(expresion).toContain('invoice_date.gte.2026-09-01')
    expect(expresion).toContain('and(invoice_date.is.null,created_at.gte.2026-09-01)')
  })

  it('makes the upper bound inclusive of the whole day', () => {
    const { q, llamadas } = consultaFalsa()
    applyInvoiceFilters(q, { dateTo: '2026-09-27' })

    const expresion = String(llamadas[0]!.argumentos[0])
    expect(expresion).toContain('invoice_date.lte.2026-09-27')
    // An upload at 14:32 on the 27th must still match "up to the 27th".
    expect(expresion).toContain('created_at.lte.2026-09-27T23:59:59.999Z')
  })

  it('combines every filter', () => {
    const { q, llamadas } = consultaFalsa()
    applyInvoiceFilters(q, {
      status: 'review_needed',
      currency: 'EUR',
      vendor: 'sum',
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    })
    expect(llamadas.map((l) => l.metodo)).toEqual(['eq', 'eq', 'ilike', 'or', 'or'])
  })
})
