import type { HistoricInvoice } from './types'

/**
 * Duplicate detection.
 *
 * Exact: same supplier and same invoice number once normalised. Paying it
 * twice is never right, even if the amounts differ — a second invoice with
 * a known number and a new amount is itself a fraud signal.
 *
 * Probable: the patterns behind most real double payments —
 *   - same supplier, same amount, issued within a week, different or
 *     missing number (the supplier re-sent it, or the scan misread it);
 *   - same number and amount under a different supplier key (the vendor
 *     name was read differently on each upload).
 */

export const PROBABLE_WINDOW_DAYS = 7

/** "F-0012" → "F12"; "2024/001" → "20241". Empty when nothing is left. */
export function normalizeInvoiceNumber(raw: string | null): string {
  if (!raw) return ''
  // Zeros are stripped per segment, before the separators disappear:
  // "2024/001" and "2024-1" are the same number, "20241" and "2024001" not.
  return raw
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .map((segment) => segment.replace(/(^|[A-Z])0+(?=\d)/g, '$1'))
    .join('')
}

export function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000
}

export interface DuplicateCandidate {
  id: string
  supplier_key: string
  invoice_number: string | null
  invoice_date: string | null
  total_cents: number | null
  currency: string | null
}

export interface DuplicateMatch {
  kind: 'exact' | 'probable'
  other: HistoricInvoice
}

export function findDuplicates(
  invoice: DuplicateCandidate,
  history: readonly HistoricInvoice[],
): DuplicateMatch[] {
  const number = normalizeInvoiceNumber(invoice.invoice_number)
  const matches: DuplicateMatch[] = []

  for (const other of history) {
    if (other.id === invoice.id || other.status === 'rejected') continue

    const otherNumber = normalizeInvoiceNumber(other.invoice_number)
    const sameSupplier = other.supplier_key === invoice.supplier_key
    const sameAmount =
      invoice.total_cents != null &&
      other.total_cents === invoice.total_cents &&
      other.currency === invoice.currency
    const sameNumber = number !== '' && otherNumber === number

    if (sameSupplier && sameNumber) {
      matches.push({ kind: 'exact', other })
      continue
    }

    const closeInTime =
      invoice.invoice_date != null &&
      other.invoice_date != null &&
      daysBetween(invoice.invoice_date, other.invoice_date) <= PROBABLE_WINDOW_DAYS

    if ((sameSupplier && sameAmount && closeInTime) || (!sameSupplier && sameNumber && sameAmount)) {
      matches.push({ kind: 'probable', other })
    }
  }

  return matches
}
