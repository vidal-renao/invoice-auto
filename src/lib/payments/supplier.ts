/**
 * Supplier identity.
 *
 * The same supplier reaches us spelt in different ways: "ESB12345678" and
 * "B-12345678" on two invoices, "Müller AG" and "MULLER AG". Payments,
 * bank accounts and duplicate checks all hang off one normalised key, so
 * that a spelling difference never splits a supplier into two — which is
 * exactly how a duplicate payment slips through.
 */

const LEGAL_FORMS = [
  'sociedad limitada unipersonal', 'sociedad limitada', 'sociedad anonima',
  'slu', 'sau', 'sl', 'sa', 'sll', 'scp', 'cb',
  'gmbh', 'ag', 'sarl', 'sagl', 'kg', 'klg',
  'ltd', 'llc', 'inc', 'bv', 'nv', 'srl', 'spa',
]

/** "ESB-12345678", "b12345678" → "B12345678"; "CHE-123.456.789 MWST" → "CHE123456789". */
export function normalizeTaxId(raw: string): string {
  let value = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  value = value.replace(/(MWST|TVA|IVA|VAT)$/, '')
  // Spanish NIF/CIF are 9 characters; the "ES" VAT prefix is the same identity.
  if (/^ES[A-Z0-9]\d{7}[A-Z0-9]$/.test(value)) value = value.slice(2)
  return value
}

/** "Müller & Söhne AG" → "mullersohne"; "ACME, S.L." → "acme". */
export function normalizeSupplierName(raw: string): string {
  let value = raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  for (const form of LEGAL_FORMS) {
    value = value.replace(new RegExp(`(^|\\s)${form}$`), '').trim()
  }
  return value.replace(/\s+/g, '')
}

/**
 * Tax id wins over name: it is printed by the supplier and survives
 * rebrands. `null` when the invoice identifies nobody.
 */
export function supplierKey(taxId: string | null, name: string | null): string | null {
  const tax = taxId ? normalizeTaxId(taxId) : ''
  if (tax.length >= 5) return `tax:${tax}`
  const normalizedName = name ? normalizeSupplierName(name) : ''
  if (normalizedName) return `name:${normalizedName}`
  return null
}
