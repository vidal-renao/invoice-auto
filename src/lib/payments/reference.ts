import { mod97 } from './iban'

/**
 * Structured creditor references that travel in the payment file.
 *
 *  - QRR  Swiss QR reference: 27 digits, last one a recursive MOD 10 check.
 *         Mandatory with a QR-IBAN, forbidden with a normal IBAN.
 *  - SCOR ISO 11649 creditor reference: "RF" + 2 check digits + up to 21
 *         alphanumerics, MOD 97-10. Valid in SEPA and in Switzerland.
 *
 * Anything else is free text and goes as unstructured remittance.
 */
export type PaymentReference =
  | { kind: 'QRR'; value: string }
  | { kind: 'SCOR'; value: string }
  | { kind: 'text'; value: string }

const MOD10_TABLE = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5] as const

/** Swiss recursive MOD 10 (the ESR/QRR check digit algorithm). */
export function mod10Recursive(digits: string): number {
  let carry = 0
  for (const d of digits) carry = MOD10_TABLE[(carry + Number(d)) % 10]!
  return (10 - carry) % 10
}

export function isValidQrr(raw: string): boolean {
  const value = raw.replace(/\s+/g, '')
  if (!/^\d{27}$/.test(value)) return false
  return mod10Recursive(value.slice(0, 26)) === Number(value[26])
}

export function isValidScor(raw: string): boolean {
  const value = raw.replace(/\s+/g, '').toUpperCase()
  if (!/^RF\d{2}[A-Z0-9]{1,21}$/.test(value)) return false
  return mod97(value.slice(4) + value.slice(0, 4)) === 1
}

/** Classifies what the invoice printed. Empty input means "no reference". */
export function parseReference(raw: string | null | undefined): PaymentReference | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  if (isValidQrr(trimmed)) return { kind: 'QRR', value: trimmed.replace(/\s+/g, '') }
  if (isValidScor(trimmed)) return { kind: 'SCOR', value: trimmed.replace(/\s+/g, '').toUpperCase() }
  return { kind: 'text', value: trimmed.slice(0, 140) }
}
