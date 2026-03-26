import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { getInvoice } from '@/lib/actions/invoices'
import { formatCurrency, formatDate } from '@/lib/utils'
import { InvoicePoller } from '@/components/invoice/InvoicePoller'
import { InvoiceActions } from '@/components/invoice/InvoiceActions'
import type { InvoiceStatus, Currency } from '@/types/database'

// ── Known failure reason codes (maps to translation keys) ─────────────────────
const KNOWN_FAILURE_CODES = new Set([
  'not_invoice',
  'image_unclear',
  'timeout_8s',
  'parsing_failed',
  'handwritten_only',
])

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('invoice')
  return { title: t('title') }
}

interface InvoicePageProps {
  params: Promise<{ locale: string; id: string }>
}

// ── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  pending:       'bg-violet-500/15 text-violet-300 border-violet-500/30',
  processing:    'bg-blue-500/15 text-blue-300 border-blue-500/30',
  review_needed: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  approved:      'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejected:      'bg-red-500/15 text-red-400 border-red-500/30',
}

function StatusBadge({
  status,
  label,
}: {
  status: InvoiceStatus
  label: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {(status === 'pending' || status === 'processing') && (
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  )
}

// ── Detail row ────────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <span className="shrink-0 text-[#888]">{label}</span>
      <span className="text-right font-medium text-[#ededed]">{value}</span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function InvoicePage({ params }: InvoicePageProps) {
  const { locale, id } = await params
  const t = await getTranslations('invoice')
  const tCommon = await getTranslations('common')

  const result = await getInvoice(id)
  if (!result) {
    // getInvoice returns null on auth failure OR not-found
    // Distinguish: if unauthenticated, layout already redirects; otherwise 404.
    notFound()
  }

  const { invoice, receiptUrl } = result
  const isPDF = invoice.receipt_path?.toLowerCase().endsWith('.pdf') ?? false
  const isPending =
    invoice.status === 'pending' || invoice.status === 'processing'

  const currency = invoice.currency as Currency
  const statusLabel = t(`status.${invoice.status}`)

  // Resolve failure reason label (translate known codes, show raw otherwise)
  const failureLabel = invoice.failure_reason
    ? KNOWN_FAILURE_CODES.has(invoice.failure_reason)
      ? t(`failureReason.${invoice.failure_reason}` as Parameters<typeof t>[0])
      : invoice.failure_reason
    : null

  return (
    <div className="space-y-6">
      {/* Auto-refresh while AI analysis is in progress */}
      <InvoicePoller isPending={isPending} />

      {/* ── Back + header ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/${locale}/invoices`}
          className="inline-flex items-center gap-1.5 text-sm text-[#888] transition-colors hover:text-[#ededed]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {t('backToInvoices')}
        </Link>

        <div className="flex items-center gap-3">
          <StatusBadge status={invoice.status} label={statusLabel} />
          <InvoiceActions
            invoiceId={invoice.id}
            receiptUrl={receiptUrl}
            isPDF={isPDF}
          />
        </div>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-[#ededed]">{t('title')}</h1>
        <p className="mt-0.5 font-mono text-xs text-[#555]">{invoice.id}</p>
      </div>

      {/* ── Main content ───────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-5">
        {/* ── Receipt preview ──────────────────────────── (2/5) */}
        <div className="md:col-span-2">
          <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111]">
            <div className="border-b border-[#2a2a2a] px-4 py-3">
              <p className="text-xs font-medium text-[#888]">
                {t('receiptPreview')}
              </p>
            </div>

            {receiptUrl && !isPDF ? (
              <div className="relative aspect-[3/4] w-full">
                <Image
                  src={receiptUrl}
                  alt={t('receiptPreview')}
                  fill
                  unoptimized
                  className="object-contain p-2"
                />
              </div>
            ) : receiptUrl && isPDF ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#555"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-12 w-12"
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
                  <path d="M14 2v6h6" />
                  <path d="M8 13h8M8 17h5" />
                </svg>
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-600"
                >
                  {t('viewPDF')}
                </a>
              </div>
            ) : (
              <div className="flex items-center justify-center px-6 py-12">
                <p className="text-sm text-[#555]">{t('noReceipt')}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Details panel ──────────────────────────── (3/5) */}
        <div className="space-y-4 md:col-span-3">
          {/* Processing notice */}
          {isPending && (
            <div className="flex items-start gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-4">
              <svg
                className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-violet-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-violet-300">
                  {t('processingTitle')}
                </p>
                <p className="mt-0.5 text-xs text-[#888]">
                  {t('processingDesc')}
                </p>
              </div>
            </div>
          )}

          {/* Extracted data card */}
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111]">
            <div className="border-b border-[#2a2a2a] px-4 py-3">
              <p className="text-xs font-medium text-[#888]">
                {t('extractedData')}
              </p>
            </div>
            <div className="divide-y divide-[#1e1e1e] px-4">
              <DetailRow label={t('details.vendor')} value={invoice.vendor_name} />
              <DetailRow
                label={t('details.vendorTaxId')}
                value={invoice.vendor_tax_id}
              />
              <DetailRow
                label={t('details.invoiceNumber')}
                value={invoice.invoice_number}
              />
              <DetailRow
                label={t('details.date')}
                value={
                  invoice.invoice_date
                    ? formatDate(invoice.invoice_date, locale)
                    : null
                }
              />
              <DetailRow
                label={t('details.subtotal')}
                value={
                  invoice.subtotal_cents != null
                    ? formatCurrency(invoice.subtotal_cents, currency, locale)
                    : null
                }
              />
              <DetailRow
                label={t('details.tax')}
                value={
                  invoice.tax_cents != null
                    ? formatCurrency(invoice.tax_cents, currency, locale)
                    : null
                }
              />
              <DetailRow
                label={t('details.total')}
                value={
                  invoice.total_cents != null
                    ? formatCurrency(invoice.total_cents, currency, locale)
                    : null
                }
              />
              {invoice.ai_confidence != null && (
                <DetailRow
                  label={t('details.confidence')}
                  value={`${Math.round(invoice.ai_confidence * 100)} %`}
                />
              )}
            </div>
            {!invoice.vendor_name &&
              !invoice.total_cents &&
              !invoice.invoice_number && (
                <div className="px-4 py-6 text-center text-sm text-[#555]">
                  {isPending ? t('dataNotYetAvailable') : t('noDataExtracted')}
                </div>
              )}
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="rounded-xl border border-[#2a2a2a] bg-[#111] px-4 py-3">
              <p className="mb-1 text-xs font-medium text-[#888]">
                {tCommon('notes')}
              </p>
              <p className="text-sm text-[#ededed]">{invoice.notes}</p>
            </div>
          )}

          {/* Failure reason — shown when AI analysis flagged a problem */}
          {failureLabel && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <p className="mb-0.5 text-xs font-medium text-amber-400">
                {t('failureReason.title')}
              </p>
              <p className="text-sm text-[#888]">{failureLabel}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
