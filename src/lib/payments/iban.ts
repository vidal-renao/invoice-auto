/**
 * IBAN handling for the payment engine.
 *
 * Only the countries reachable by the two payment routes we generate are
 * listed: SEPA (EUR) and Swiss domestic (CHF). An IBAN from anywhere else is
 * not "invalid" — it is simply outside what this engine may pay, and the
 * decision engine says so explicitly instead of guessing a route.
 */

/** IBAN length per SEPA-scheme country (EPC list of countries, 2024). */
const SEPA_IBAN_LENGTH: Readonly<Record<string, number>> = {
  AD: 24, AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18,
  EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GI: 23, GR: 27, HR: 21, HU: 28,
  IE: 22, IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31,
  NL: 18, NO: 15, PL: 28, PT: 25, RO: 24, SE: 24, SI: 19, SK: 24, SM: 27,
  VA: 22,
}

export type IbanProblem = 'format' | 'country' | 'length' | 'checksum'

export type IbanCheck =
  | { valid: true; iban: string; country: string }
  | { valid: false; problem: IbanProblem }

/** Removes spaces and upper-cases: the electronic format banks expect. */
export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

/** ISO 7064 MOD 97-10 over an alphanumeric string (letters A=10 … Z=35). */
export function mod97(value: string): number {
  let remainder = 0
  for (const char of value) {
    const code = char.charCodeAt(0)
    const digits = code >= 65 && code <= 90 ? String(code - 55) : char
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97
  }
  return remainder
}

export function checkIban(raw: string): IbanCheck {
  const iban = normalizeIban(raw)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(iban)) return { valid: false, problem: 'format' }

  const country = iban.slice(0, 2)
  const expected = SEPA_IBAN_LENGTH[country]
  if (expected === undefined) return { valid: false, problem: 'country' }
  if (iban.length !== expected) return { valid: false, problem: 'length' }

  if (mod97(iban.slice(4) + iban.slice(0, 4)) !== 1) return { valid: false, problem: 'checksum' }
  return { valid: true, iban, country }
}

export function isSepaCountry(country: string): boolean {
  return country in SEPA_IBAN_LENGTH
}

/**
 * QR-IBAN: a Swiss/Liechtenstein IBAN whose institution id (positions 5–9)
 * is in the reserved range 30000–31999. It may only be paid with a QR
 * reference (QRR); banks reject anything else. Assumes a valid IBAN.
 */
export function isQrIban(iban: string): boolean {
  const normalized = normalizeIban(iban)
  const country = normalized.slice(0, 2)
  if (country !== 'CH' && country !== 'LI') return false
  const iid = Number(normalized.slice(4, 9))
  return iid >= 30000 && iid <= 31999
}

/** "ES91 2100 0418 4502 0005 1332" — for display only. */
export function formatIban(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})(?=.)/g, '$1 ')
}

/**
 * Shows country, check digits and the last four characters. Enough for a
 * person to recognise the account; not enough to copy it from a screenshot
 * or an audit export.
 */
export function maskIban(iban: string): string {
  const n = normalizeIban(iban)
  if (n.length <= 8) return n
  return `${n.slice(0, 4)} •••• ${n.slice(-4)}`
}
