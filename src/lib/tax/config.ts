/**
 * Multi-country Tax Intelligence Configuration
 *
 * Defines VAT/IVA rates and Tax ID validation patterns for each supported country.
 * Rates are stored as decimals (0.21 = 21%).
 */

export interface CountryTaxConfig {
  name: string
  nameEs: string
  flag: string
  currency: string
  /** All legal VAT rates as decimal fractions, ordered standard → reduced */
  vatRates: number[]
  standardRate: number
  /** Label used for the tax identifier in official documents */
  taxIdLabel: string
  /** Regex matching the cleaned (no spaces/dashes) Tax ID string (case-insensitive) */
  taxIdPattern: RegExp
  /** True if this country is in the EU VAT area (relevant for reverse-charge detection) */
  euMember: boolean
}

export const COUNTRY_TAX_CONFIG: Record<string, CountryTaxConfig> = {
  ES: {
    name: 'Spain',
    nameEs: 'España',
    flag: '🇪🇸',
    currency: 'EUR',
    // IVA general 21 %, reducido 10 %, superreducido 4 %
    vatRates: [0.21, 0.10, 0.04],
    standardRate: 0.21,
    taxIdLabel: 'NIF/CIF',
    // NIF: 8 digits + letter
    // CIF: letter + 7 digits + digit/letter
    // NIE: X/Y/Z + 7 digits + letter
    taxIdPattern:
      /^([0-9]{8}[A-Z]|[A-HJNPQRSUVW][0-9]{7}[0-9A-J]|[XYZ][0-9]{7}[A-Z])$/i,
    euMember: true,
  },
  CH: {
    name: 'Switzerland',
    nameEs: 'Suiza',
    flag: '🇨🇭',
    currency: 'CHF',
    // MWST/TVA/IVA: 8.1 % standard, 3.8 % accommodation, 2.6 % reduced
    vatRates: [0.081, 0.038, 0.026],
    standardRate: 0.081,
    taxIdLabel: 'UID/MWST',
    // CHE-XXX.XXX.XXX [MWST|TVA|IVA|VAT]
    taxIdPattern:
      /^CHE[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}\s?(MWST|TVA|IVA|VAT)?$/i,
    euMember: false,
  },
  DE: {
    name: 'Germany',
    nameEs: 'Alemania',
    flag: '🇩🇪',
    currency: 'EUR',
    // MwSt: 19 % standard, 7 % reduced
    vatRates: [0.19, 0.07],
    standardRate: 0.19,
    taxIdLabel: 'USt-IdNr.',
    // DE + 9 digits
    taxIdPattern: /^DE[0-9]{9}$/i,
    euMember: true,
  },
  GB: {
    name: 'United Kingdom',
    nameEs: 'Reino Unido',
    flag: '🇬🇧',
    currency: 'GBP',
    // VAT: 20 % standard, 5 % reduced, 0 % zero-rated
    vatRates: [0.20, 0.05, 0],
    standardRate: 0.20,
    taxIdLabel: 'VAT No.',
    // GB + 9 or 12 digits, or GBGD/GBHA + 3 digits
    taxIdPattern: /^GB([0-9]{9}|[0-9]{12}|(GD|HA)[0-9]{3})$/i,
    euMember: false,
  },
  FR: {
    name: 'France',
    nameEs: 'Francia',
    flag: '🇫🇷',
    currency: 'EUR',
    // TVA: 20 %, 10 %, 5.5 %, 2.1 %
    vatRates: [0.20, 0.10, 0.055, 0.021],
    standardRate: 0.20,
    taxIdLabel: 'N° TVA',
    // FR + 2 alphanumeric chars + 9 digits (SIREN)
    taxIdPattern: /^FR[A-Z0-9]{2}[0-9]{9}$/i,
    euMember: true,
  },
  IT: {
    name: 'Italy',
    nameEs: 'Italia',
    flag: '🇮🇹',
    currency: 'EUR',
    // IVA: 22 %, 10 %, 5 %, 4 %
    vatRates: [0.22, 0.10, 0.05, 0.04],
    standardRate: 0.22,
    taxIdLabel: 'P.IVA',
    // IT + 11 digits
    taxIdPattern: /^IT[0-9]{11}$/i,
    euMember: true,
  },
  NL: {
    name: 'Netherlands',
    nameEs: 'Países Bajos',
    flag: '🇳🇱',
    currency: 'EUR',
    // BTW: 21 % standard, 9 % reduced
    vatRates: [0.21, 0.09],
    standardRate: 0.21,
    taxIdLabel: 'BTW-nr.',
    // NL + 9 digits + B + 2 digits
    taxIdPattern: /^NL[0-9]{9}B[0-9]{2}$/i,
    euMember: true,
  },
  PT: {
    name: 'Portugal',
    nameEs: 'Portugal',
    flag: '🇵🇹',
    currency: 'EUR',
    // IVA: 23 % standard, 13 % intermediate, 6 % reduced
    vatRates: [0.23, 0.13, 0.06],
    standardRate: 0.23,
    taxIdLabel: 'NIF/NIPC',
    // PT + 9 digits
    taxIdPattern: /^PT[0-9]{9}$/i,
    euMember: true,
  },
  BE: {
    name: 'Belgium',
    nameEs: 'Bélgica',
    flag: '🇧🇪',
    currency: 'EUR',
    // TVA/BTW: 21 % standard, 12 % intermediate, 6 % reduced
    vatRates: [0.21, 0.12, 0.06],
    standardRate: 0.21,
    taxIdLabel: 'BTW/TVA',
    // BE + 10 digits
    taxIdPattern: /^BE[0-9]{10}$/i,
    euMember: true,
  },
  AT: {
    name: 'Austria',
    nameEs: 'Austria',
    flag: '🇦🇹',
    currency: 'EUR',
    // MwSt: 20 % standard, 13 % intermediate, 10 % reduced
    vatRates: [0.20, 0.13, 0.10],
    standardRate: 0.20,
    taxIdLabel: 'UID',
    // ATU + 8 digits
    taxIdPattern: /^ATU[0-9]{8}$/i,
    euMember: true,
  },
  PL: {
    name: 'Poland',
    nameEs: 'Polonia',
    flag: '🇵🇱',
    currency: 'PLN',
    // VAT: 23 % standard, 8 % reduced, 5 % food/books
    vatRates: [0.23, 0.08, 0.05],
    standardRate: 0.23,
    taxIdLabel: 'NIP',
    // PL + 10 digits
    taxIdPattern: /^PL[0-9]{10}$/i,
    euMember: true,
  },
  SE: {
    name: 'Sweden',
    nameEs: 'Suecia',
    flag: '🇸🇪',
    currency: 'SEK',
    // Moms: 25 % standard, 12 % reduced, 6 % culture/transport
    vatRates: [0.25, 0.12, 0.06],
    standardRate: 0.25,
    taxIdLabel: 'Moms-nr.',
    // SE + 12 digits
    taxIdPattern: /^SE[0-9]{12}$/i,
    euMember: true,
  },
  DK: {
    name: 'Denmark',
    nameEs: 'Dinamarca',
    flag: '🇩🇰',
    currency: 'DKK',
    // Moms: 25 % (single rate)
    vatRates: [0.25],
    standardRate: 0.25,
    taxIdLabel: 'CVR/moms',
    // DK + 8 digits
    taxIdPattern: /^DK[0-9]{8}$/i,
    euMember: true,
  },
  NO: {
    name: 'Norway',
    nameEs: 'Noruega',
    flag: '🇳🇴',
    currency: 'NOK',
    // MVA: 25 % standard, 15 % food, 12 % transport/cinema
    vatRates: [0.25, 0.15, 0.12],
    standardRate: 0.25,
    taxIdLabel: 'Org.nr./MVA',
    // NO + 9 digits + optional MVA
    taxIdPattern: /^NO[0-9]{9}(MVA)?$/i,
    euMember: false,
  },
  IE: {
    name: 'Ireland',
    nameEs: 'Irlanda',
    flag: '🇮🇪',
    currency: 'EUR',
    // VAT: 23 % standard, 13.5 % reduced, 9 % hospitality, 4.8 % agri
    vatRates: [0.23, 0.135, 0.09, 0.048],
    standardRate: 0.23,
    taxIdLabel: 'VAT No.',
    // IE + 7 digits + 1-2 letters
    taxIdPattern: /^IE[0-9]{7}[A-Z]{1,2}$/i,
    euMember: true,
  },
  LU: {
    name: 'Luxembourg',
    nameEs: 'Luxemburgo',
    flag: '🇱🇺',
    currency: 'EUR',
    // TVA: 17 % standard, 14 % parking, 8 % intermediate, 3 % reduced
    vatRates: [0.17, 0.14, 0.08, 0.03],
    standardRate: 0.17,
    taxIdLabel: 'N° TVA',
    // LU + 8 digits
    taxIdPattern: /^LU[0-9]{8}$/i,
    euMember: true,
  },
}

// ── Detection helpers ───────────────────────────────────────────────────────

/**
 * Ordered list of Tax ID prefix patterns → country codes.
 * More specific patterns must come before more general ones.
 */
export const TAX_ID_PREFIX_MAP: Array<{ prefix: RegExp; countryCode: string }> =
  [
    { prefix: /^CHE/i, countryCode: 'CH' },
    { prefix: /^ATU/i, countryCode: 'AT' },
    { prefix: /^AT/i, countryCode: 'AT' },
    { prefix: /^BE/i, countryCode: 'BE' },
    { prefix: /^DE/i, countryCode: 'DE' },
    { prefix: /^DK/i, countryCode: 'DK' },
    { prefix: /^ES/i, countryCode: 'ES' },
    { prefix: /^FR/i, countryCode: 'FR' },
    { prefix: /^GB/i, countryCode: 'GB' },
    { prefix: /^IE/i, countryCode: 'IE' },
    { prefix: /^IT/i, countryCode: 'IT' },
    { prefix: /^LU/i, countryCode: 'LU' },
    { prefix: /^NL/i, countryCode: 'NL' },
    { prefix: /^NO/i, countryCode: 'NO' },
    { prefix: /^PL/i, countryCode: 'PL' },
    { prefix: /^PT/i, countryCode: 'PT' },
    { prefix: /^SE/i, countryCode: 'SE' },
  ]

/**
 * Spanish NIF/CIF/NIE without country prefix (no leading "ES").
 * Matches:
 *   NIF: 8 digits + letter
 *   CIF: [A-HJNPQRSUVW] + 7 digits + digit/letter
 *   NIE: [XYZ] + 7 digits + letter
 */
export const SPANISH_NIF_PATTERN =
  /^([0-9]{8}[A-Z]|[A-HJNPQRSUVW][0-9]{7}[0-9A-J]|[XYZ][0-9]{7}[A-Z])$/i

/** Returns true if the given country code is in the EU VAT area */
export function isEuCountry(countryCode: string): boolean {
  return COUNTRY_TAX_CONFIG[countryCode]?.euMember ?? false
}

/** Returns all VAT rates for a country as percentages (e.g. [21, 10, 4]) */
export function getVatRatesPercent(countryCode: string): number[] {
  return (COUNTRY_TAX_CONFIG[countryCode]?.vatRates ?? []).map(
    (r) => Math.round(r * 1000) / 10
  )
}
