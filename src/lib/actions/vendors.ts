'use server'

import { createClient } from '@/lib/supabase/server'
import type { VendorCategory } from '@/types/database'

// ── Public types ──────────────────────────────────────────────────────────────

/** A vendor derived from analyzed invoice data, optionally enriched from the vendors table. */
export interface VendorRow {
  name: string
  tax_id: string | null
  country_code: string | null
  category: VendorCategory | null
  invoice_count: number
  total_cents: number
  currency: string
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Derive unique vendors from analyzed invoices, then enrich with category data
 * from the vendors table (keyed by tax_id).
 *
 * Deriving from invoices means the directory is populated automatically
 * as soon as any receipt has been analyzed — no manual setup required.
 */
export async function listVendors(): Promise<VendorRow[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  // 1. Fetch all invoice vendor fields in parallel with vendors table
  const [invoicesRes, vendorsRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('vendor_name, vendor_tax_id, country_code, total_cents, currency')
      .eq('user_id', user.id)
      .not('vendor_name', 'is', null),
    supabase
      .from('vendors')
      .select('tax_id, category')
      .eq('user_id', user.id)
      .not('tax_id', 'is', null),
  ])

  if (invoicesRes.error) {
    console.error('[listVendors] Failed to fetch invoices:', invoicesRes.error.message)
    return []
  }

  // 2. Build a category lookup from the vendors table (tax_id → category)
  const categoryMap = new Map<string, VendorCategory | null>()
  for (const v of vendorsRes.data ?? []) {
    if (v.tax_id) categoryMap.set(v.tax_id, v.category as VendorCategory | null)
  }

  // 3. Group invoices by vendor (tax_id preferred; vendor_name as fallback key)
  const vendorMap = new Map<string, VendorRow>()
  for (const row of invoicesRes.data ?? []) {
    const key = row.vendor_tax_id ?? row.vendor_name!
    if (!vendorMap.has(key)) {
      vendorMap.set(key, {
        name: row.vendor_name!,
        tax_id: row.vendor_tax_id ?? null,
        country_code: row.country_code ?? null,
        category: row.vendor_tax_id ? (categoryMap.get(row.vendor_tax_id) ?? null) : null,
        invoice_count: 0,
        total_cents: 0,
        currency: row.currency ?? 'EUR',
      })
    }
    const v = vendorMap.get(key)!
    v.invoice_count++
    v.total_cents += (row as { total_cents: number | null }).total_cents ?? 0
  }

  // 4. Sort alphabetically by name
  return Array.from(vendorMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  )
}
