import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { listInvoices } from '@/lib/actions/invoices'
import { ScanTicketButton } from '@/components/dashboard/ScanTicketButton'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { InvoiceStatus, Currency } from '@/types/database'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav')
  return { title: t('invoices') }
}

interface InvoicesPageProps {
  params: Promise<{ locale: string }>
}

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  pending:       'bg-violet-500/15 text-violet-300 border-violet-500/30',
  processing:    'bg-blue-500/15 text-blue-300 border-blue-500/30',
  review_needed: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  approved:      'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejected:      'bg-red-500/15 text-red-400 border-red-500/30',
}

export default async function InvoicesPage({ params }: InvoicesPageProps) {
  const { locale } = await params
  const t = await getTranslations('invoices')
  const tInvoice = await getTranslations('invoice')
  const invoices = await listInvoices()

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[#ededed]">{t('title')}</h1>
        <ScanTicketButton variant="header" />
      </div>

      {/* ── List ─────────────────────────────────────────────────── */}
      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#111] py-20 text-center">
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
          <p className="text-sm font-medium text-[#ededed]">{t('empty.title')}</p>
          <p className="mt-1 text-xs text-[#888]">{t('empty.description')}</p>
          <div className="mt-8">
            <ScanTicketButton variant="hero" />
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#888]">
                  {tInvoice('details.vendor')}
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-[#888] sm:table-cell">
                  {tInvoice('details.invoiceNumber')}
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-[#888] md:table-cell">
                  {tInvoice('details.date')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#888]">
                  {tInvoice('details.total')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#888]">
                  {t('status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e]">
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="group transition-colors hover:bg-[#161616]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/${locale}/invoices/${invoice.id}`}
                      className="block font-medium text-[#ededed] after:absolute after:inset-0 group-hover:text-white"
                    >
                      {invoice.vendor_name ?? (
                        <span className="text-[#555]">{t('unknownVendor')}</span>
                      )}
                    </Link>
                    <p className="mt-0.5 font-mono text-[10px] text-[#555]">
                      {invoice.id.slice(0, 8)}…
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 text-[#888] sm:table-cell">
                    {invoice.invoice_number ?? '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-[#888] md:table-cell">
                    {invoice.invoice_date
                      ? formatDate(invoice.invoice_date, locale)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-[#ededed]">
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
        </div>
      )}
    </div>
  )
}
