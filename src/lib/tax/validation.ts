/**
 * Tax Intelligence Validation Engine
 *
 * Provides:
 *  - Country detection from Tax ID format
 *  - Tax ID format validation per country
 *  - VAT math validation (does the extracted rate match legal rates?)
 *  - Reverse-charge / Inversión del Sujeto Pasivo detection
 */

import {
  COUNTRY_TAX_CONFIG,
  TAX_ID_PREFIX_MAP,
  SPANISH_NIF_PATTERN,
  isEuCountry,
} from './config'

export type TaxValidationStatus = 'valid' | 'discrepancy' | 'unknown'

/**
 * Tolerance for floating-point rate comparison.
 * 0.005 = 0.5 percentage points — handles rounding artefacts.
 */
const RATE_TOLERANCE = 0.005

// ── Country detection ───────────────────────────────────────────────────────

/**
 * Infers the ISO 3166-1 alpha-2 country code from a Tax ID string.
 *
 * Strategy:
 *  1. Strip whitespace, dots, and dashes.
 *  2. Match EU VAT prefixes (DE, FR, IT, …) via TAX_ID_PREFIX_MAP.
 *  3. If no prefix matches, test against Spanish NIF/CIF/NIE (no prefix).
 *
 * Returns null if the country cannot be determined.
 */
export function detectCountryFromTaxId(
  taxId: string | null | undefined
): string | null {
  if (!taxId) return null

  const cleaned = taxId.replace(/[\s.\-]/g, '').toUpperCase()

  for (const { prefix, countryCode } of TAX_ID_PREFIX_MAP) {
    if (prefix.test(cleaned)) return countryCode
  }

  if (SPANISH_NIF_PATTERN.test(cleaned)) return 'ES'

  return null
}

// ── Tax ID format validation ────────────────────────────────────────────────

/**
 * Validates the format of a Tax ID against the official pattern for the given country.
 *
 * Returns:
 *  - true  — format is valid
 *  - false — format is invalid
 *  - null  — unknown country or missing Tax ID
 */
export function validateTaxIdFormat(
  taxId: string | null | undefined,
  countryCode: string
): boolean | null {
  if (!taxId) return null

  const config = COUNTRY_TAX_CONFIG[countryCode]
  if (!config) return null

  const cleaned = taxId.replace(/[\s.\-]/g, '').toUpperCase()
  return config.taxIdPattern.test(cleaned)
}

// ── VAT math validation ─────────────────────────────────────────────────────

/**
 * Validates that extracted VAT amounts are mathematically consistent with
 * the legal VAT rates for the detected country.
 *
 * Algorithm:
 *  1. Calculate effectiveRate = taxCents / subtotalCents.
 *  2. Verify subtotal + tax ≈ total (allow ±2 cents for rounding).
 *  3. Check if effectiveRate is within RATE_TOLERANCE of any legal rate.
 *
 * Returns:
 *  - 'valid'       — math checks out with a known legal rate (or 0%)
 *  - 'discrepancy' — the effective rate does not match any legal rate, or total mismatch
 *  - 'unknown'     — insufficient data to validate
 */
export function validateVatMath(
  subtotalCents: number | null,
  taxCents: number | null,
  totalCents: number | null,
  countryCode: string | null
): TaxValidationStatus {
  if (!countryCode) return 'unknown'
  if (subtotalCents == null || taxCents == null) return 'unknown'
  if (subtotalCents <= 0) return 'unknown'

  const config = COUNTRY_TAX_CONFIG[countryCode]
  if (!config) return 'unknown'

  // 1. Verify total integrity (subtotal + tax should equal total)
  if (totalCents != null) {
    const calculatedTotal = subtotalCents + taxCents
    if (Math.abs(calculatedTotal - totalCents) > 2) return 'discrepancy'
  }

  // 2. Calculate effective rate
  const effectiveRate = taxCents / subtotalCents

  // 3. 0% is valid (tax-exempt, reverse charge, etc.)
  if (Math.abs(effectiveRate) < RATE_TOLERANCE) return 'valid'

  // 4. Match against known legal rates
  const matchesLegalRate = config.vatRates.some(
    (rate) => Math.abs(effectiveRate - rate) <= RATE_TOLERANCE
  )

  return matchesLegalRate ? 'valid' : 'discrepancy'
}

// ── Reverse charge detection ────────────────────────────────────────────────

/**
 * Keyword list for reverse charge / Inversión del Sujeto Pasivo detection.
 * Covers Spanish, German, English, French, and Italian terminology.
 */
const REVERSE_CHARGE_KEYWORDS = [
  'reverse charge',
  'inversión del sujeto pasivo',
  'steuerschuldnerschaft des leistungsempfängers',
  'autoliquidación',
  'artikel 196',
  'article 196',
  'operación intracomunitaria',
  'intra-community supply',
  'intracommunautaire',
  'innergemeinschaftliche lieferung',
  'acquisto intracomunitario',
  'operación exenta art',
]

/**
 * Determines whether a transaction is likely subject to reverse charge
 * (Inversión del Sujeto Pasivo).
 *
 * Triggers:
 *  1. AI raw text contains reverse-charge keywords.
 *  2. Tax is 0 or null while subtotal > 0, AND both vendor and user are in
 *     different EU member states (intra-community B2B supply).
 *
 * @param taxCents          - Extracted tax amount in cents (null = not found)
 * @param subtotalCents     - Extracted subtotal in cents (null = not found)
 * @param vendorCountryCode - Country code inferred from vendor's Tax ID
 * @param userCountryCode   - Country code from the user's profile
 * @param aiRawText         - Raw text from the AI response for keyword search
 */
export function detectReverseCharge(
  taxCents: number | null,
  subtotalCents: number | null,
  vendorCountryCode: string | null,
  userCountryCode: string | null,
  aiRawText?: string
): boolean {
  // 1. Keyword match in AI raw response
  if (aiRawText) {
    const lower = aiRawText.toLowerCase()
    if (REVERSE_CHARGE_KEYWORDS.some((kw) => lower.includes(kw))) return true
  }

  // 2. Zero-VAT intra-community supply
  if (
    subtotalCents != null &&
    subtotalCents > 0 &&
    (taxCents === 0 || taxCents === null) &&
    vendorCountryCode &&
    userCountryCode &&
    vendorCountryCode !== userCountryCode &&
    isEuCountry(vendorCountryCode) &&
    isEuCountry(userCountryCode)
  ) {
    return true
  }

  return false
}

// ── Convenience re-exports ──────────────────────────────────────────────────

export { detectCountryFromTaxId as default }
