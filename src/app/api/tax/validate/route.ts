import { NextRequest, NextResponse } from 'next/server'
import { detectCountryFromTaxId, validateTaxIdFormat } from '@/lib/tax/validation'
import { COUNTRY_TAX_CONFIG } from '@/lib/tax/config'

/**
 * GET /api/tax/validate?taxId=ESB12345678
 *
 * Validates the format of a Tax ID and returns:
 *  - countryCode   — detected ISO 3166-1 alpha-2 code
 *  - countryName   — localised country name (Spanish)
 *  - flag          — emoji flag
 *  - taxIdLabel    — official label in that country (NIF/CIF, UID, etc.)
 *  - formatValid   — whether the format matches the official pattern
 *  - vatRates      — legal VAT rates for that country (as percentages)
 *
 * Returns 400 if taxId is missing.
 * Returns 200 with formatValid: null if the country is not recognised.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const taxId = request.nextUrl.searchParams.get('taxId')

  if (!taxId || taxId.trim() === '') {
    return NextResponse.json(
      { error: 'Missing required query parameter: taxId' },
      { status: 400 }
    )
  }

  const countryCode = detectCountryFromTaxId(taxId)
  const config = countryCode ? COUNTRY_TAX_CONFIG[countryCode] : undefined

  const formatValid = countryCode
    ? validateTaxIdFormat(taxId, countryCode)
    : null

  const vatRatesPercent = config
    ? config.vatRates.map((r) => Math.round(r * 1000) / 10)
    : null

  return NextResponse.json({
    taxId: taxId.trim(),
    countryCode,
    countryName: config?.nameEs ?? null,
    flag: config?.flag ?? null,
    taxIdLabel: config?.taxIdLabel ?? null,
    formatValid,
    vatRates: vatRatesPercent,
    euMember: config?.euMember ?? null,
  })
}
