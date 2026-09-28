import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { listInvoices } from '@/lib/actions/invoices'
import type { InvoiceFilters } from '@/lib/invoices/filters'
import { ScanTicketButton } from '@/components/dashboard/ScanTicketButton'
import { InvoicesFilters } from '@/components/invoices/InvoicesFilters'
import { ExportMenu } from '@/components/invoices/ExportMenu'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { InvoiceStatus, Currency } from '@/types/database'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav')
  return { title: t('invoices') }
}

interface InvoicesPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  pending:       'bg-violet-500/15 text-accent-text border-violet-500/30',
  processing:    'bg-blue-500/15 text-accent-text border-blue-500/30',
  review_needed: 'bg-amber-500/15 text-warning-text border-amber-500/30',
  approved:      'bg-emerald-500/15 text-success-text border-emerald-500/30',
  rejected:      'bg-red-500/15 text-danger-text border-red-500/30',
}

function str(val: string | string[] | undefined): string | undefined {
  return typeof val === 'string' && val.length > 0 ? val : undefined
}

export default async function InvoicesPage({ params, searchParams }: InvoicesPageProps) {
  const { locale } = await params
  const sp = await searchParams
  const t = await getTranslations('invoices')
  const tInvoice = await getTranslations('invoice')

  const filters: InvoiceFilters = {
    vendor: str(sp.vendor),
    status: str(sp.status),
    currency: str(sp.currency),
    dateFrom: str(sp.dateFrom),
    dateTo: str(sp.dateTo),
  }

  const invoices = await listInvoices(filters)
  const hasFilters = Object.values(filters).some(Boolean)

  // Build export URL preserving current filters
  const exportParams = new URLSearchParams()
  if (filters.vendor) exportParams.set('vendor', filters.vendor)
  if (filters.status) exportParams.set('status', filters.status)
  if (filters.currency) exportParams.set('currency', filters.currency)
  if (filters.dateFrom) exportParams.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) exportParams.set('dateTo', filters.dateTo)
  const exportHref = `/api/invoices/export${exportParams.size > 0 ? `?${exportParams.toString()}` : ''}`

  return (
    <div className="space-y-5">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-ink">{t('title')}</h1>
        <div className="flex items-center gap-2">
          {/* Export dropdown — only shown when there are invoices */}
          {invoices.length > 0 && (
            <ExportMenu exportHref={exportHref} />
          )}
          <ScanTicketButton variant="header" />
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <InvoicesFilters />
      </Suspense>

      {/* What is actually being filtered, in words. Without it, a filter that
          returns nothing is indistinguishable from an empty account, and one
          that is still set from an earlier click is invisible. */}
      {hasFilters && (
        <p className="text-xs text-muted">
          {t('activeFilters')}:{' '}
          {[
            filters.status && `${t('status')}: ${tInvoice(`status.${filters.status}`)}`,
            filters.currency && filters.currency,
            filters.vendor && `"${filters.vendor}"`,
            filters.dateFrom && `${t('filters.dateFrom')} ${filters.dateFrom}`,
            filters.dateTo && `${t('filters.dateTo')} ${filters.dateTo}`,
          ]
            .filter(Boolean)
            .join(' · ')}{' '}
          — {t('rowCount', { count: invoices.length })}
        </p>
      )}

      {/* ── List ─────────────────────────────────────────────────── */}
      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-surface py-20 text-center">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#555"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mb-4"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
            <path d="M14 2v6h6" />
            <path d="M8 13h8M8 17h5" />
          </svg>
          <p className="text-sm font-medium text-ink">{t('empty.title')}</p>
          <p className="mt-1 text-xs text-muted">
            {hasFilters ? t('empty.noResults') : t('empty.description')}
          </p>
          {!hasFilters && (
            <div className="mt-8">
              <ScanTicketButton variant="hero" />
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">
                  {tInvoice('details.vendor')}
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted sm:table-cell">
                  {tInvoice('details.invoiceNumber')}
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted md:table-cell">
                  {tInvoice('details.date')}
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted lg:table-cell">
                  {tInvoice('details.uploaded')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted">
                  {tInvoice('details.total')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted">
                  {t('status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-elevated-2">
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  // `relative` is what scopes the row link's full-surface
                  // overlay to this row. Without it the overlay resolves
                  // against the page and covers everything above the table —
                  // the filters included, so every click on them opened the
                  // last invoice instead of filtering.
                  className="group relative transition-colors hover:bg-surface-2"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/${locale}/invoices/${invoice.id}`}
                      className="block font-medium text-ink after:absolute after:inset-0 group-hover:text-white"
                    >
                      {invoice.vendor_name ?? (
                        <span className="text-faint">{t('unknownVendor')}</span>
                      )}
                    </Link>
                    <p className="mt-0.5 truncate text-[11px] text-faint" title={invoice.original_filename ?? undefined}>
                      {invoice.original_filename ?? `${invoice.id.slice(0, 8)}…`}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">
                    {invoice.invoice_number ?? '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-muted md:table-cell">
                    {invoice.invoice_date
                      ? formatDate(invoice.invoice_date, locale)
                      : '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-muted lg:table-cell">
                    {formatDate(invoice.created_at, locale)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-ink">
                    {invoice.total_cents != null
                      ? formatCurrency(
                          invoice.total_cents,
                          invoice.currency as Currency,
                          locale
                        )
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[invoice.status]}`}
                    >
                      {tInvoice(`status.${invoice.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Row count */}
          <div className="border-t border-elevated-2 px-4 py-2.5">
            <p className="text-xs text-faint">
              {t('rowCount', { count: invoices.length })}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
