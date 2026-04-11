import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { listVendors } from '@/lib/actions/vendors'
import { formatCurrency } from '@/lib/utils'
import { COUNTRY_TAX_CONFIG } from '@/lib/tax/config'
import type { VendorCategory, Currency } from '@/types/database'
import type { VendorRow } from '@/lib/actions/vendors'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav')
  return { title: t('clients') }
}

const CATEGORY_STYLES: Record<VendorCategory, string> = {
  software:     'bg-violet-500/15 text-violet-300 border-violet-500/30',
  utilities:    'bg-blue-500/15 text-blue-300 border-blue-500/30',
  travel:       'bg-amber-500/15 text-amber-300 border-amber-500/30',
  marketing:    'bg-pink-500/15 text-pink-300 border-pink-500/30',
  professional: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  office:       'bg-sky-500/15 text-sky-300 border-sky-500/30',
  other:        'bg-neutral-500/15 text-neutral-400 border-neutral-500/30',
}

interface ClientsPageProps {
  params: Promise<{ locale: string }>
}

export default async function ClientsPage({ params }: ClientsPageProps) {
  const { locale } = await params
  const t = await getTranslations('clients')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const vendors = await listVendors()

  // Compute summary stats
  const totalSpent = vendors.reduce((s, v) => s + v.total_cents, 0)
  const topVendor = vendors.length > 0
    ? vendors.reduce((a, b) => b.total_cents > a.total_cents ? b : a)
    : null

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#ededed]">{t('title')}</h1>
        {vendors.length > 0 && (
          <span className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-2.5 py-1 text-xs text-[#888]">
            {t('rowCount', { count: vendors.length })}
          </span>
        )}
      </div>

      {/* ── Summary cards ──────────────────────────── */}
      {vendors.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111] px-4 py-3">
            <p className="text-xs text-[#555]">{t('rowCount', { count: vendors.length })}</p>
            <p className="mt-1 text-2xl font-bold text-[#ededed]">{vendors.length}</p>
          </div>
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111] px-4 py-3">
            <p className="text-xs text-[#555]">{t('table.total')}</p>
            <p className="mt-1 text-2xl font-bold text-violet-300">
              {formatCurrency(totalSpent, 'EUR', locale)}
            </p>
          </div>
          {topVendor && (
            <div className="col-span-2 rounded-xl border border-[#2a2a2a] bg-[#111] px-4 py-3 sm:col-span-1">
              <p className="text-xs text-[#555]">Top vendor</p>
              <p className="mt-1 truncate text-sm font-semibold text-[#ededed]">{topVendor.name}</p>
              <p className="text-xs text-violet-300">{formatCurrency(topVendor.total_cents, topVendor.currency as Currency, locale)}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ─────────────────────────────── */}
      {vendors.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#111] py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none" stroke="#555" strokeWidth="1.4" className="h-7 w-7">
              <circle cx="6" cy="5" r="2.5" />
              <path d="M1 13c0-2.21 2.239-4 5-4s5 1.79 5 4" strokeLinecap="round" />
              <path d="M11 7c1.38 0 2.5 1.12 2.5 2.5S12.38 12 11 12" strokeLinecap="round" />
              <path d="M13.5 13c0-1.1-.7-2.06-1.75-2.6" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#ededed]">{t('empty.title')}</p>
          <p className="mt-1 max-w-xs text-xs text-[#888]">{t('empty.description')}</p>
        </div>
      )}

      {/* ── Table ───────────────────────────────────── */}
      {vendors.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#555]">{t('table.name')}</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#555] sm:table-cell">{t('table.taxId')}</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#555] md:table-cell">{t('table.country')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#555]">{t('table.category')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#555]">{t('table.invoiceCount')}</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#555] sm:table-cell">{t('table.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e1e]">
                {vendors.map((vendor: VendorRow) => {
                  const config = vendor.country_code
                    ? COUNTRY_TAX_CONFIG[vendor.country_code as keyof typeof COUNTRY_TAX_CONFIG]
                    : null
                  const flag = config?.flag ?? ''
                  return (
                    <tr key={vendor.tax_id ?? vendor.name} className="group transition-colors duration-100 hover:bg-[#1a1a1a]">
                      <td className="px-4 py-3">
                        <span className="font-medium text-[#ededed]">{vendor.name}</span>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        {vendor.tax_id
                          ? <span className="font-mono text-xs text-[#888]">{vendor.tax_id}</span>
                          : <span className="text-[#444]">—</span>}
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        {vendor.country_code
                          ? <span className="flex items-center gap-1.5 text-[#aaa]">
                              {flag && <span aria-hidden="true">{flag}</span>}
                              <span className="font-mono text-xs">{vendor.country_code}</span>
                            </span>
                          : <span className="text-[#444]">{t('unknownCountry')}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {vendor.category
                          ? <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[vendor.category]}`}>
                              {t(`category.${vendor.category}`)}
                            </span>
                          : <span className="inline-flex items-center rounded-md border border-[#2a2a2a] px-2 py-0.5 text-xs text-[#444]">
                              {t('category.none')}
                            </span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="tabular-nums text-[#888]">{vendor.invoice_count}</span>
                      </td>
                      <td className="hidden px-4 py-3 text-right sm:table-cell">
                        <span className="tabular-nums font-medium text-[#ededed]">
                          {vendor.total_cents > 0
                            ? formatCurrency(vendor.total_cents, vendor.currency as Currency, locale)
                            : <span className="text-[#444]">—</span>}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
