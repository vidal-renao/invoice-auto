import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { getInvoice } from '@/lib/actions/invoices'
import { formatCurrency, formatDate } from '@/lib/utils'
import { AnalysisStatusWrapper } from '@/components/invoice/AnalysisStatusWrapper'
import { InvoiceActions } from '@/components/invoice/InvoiceActions'
import { ClientContactPanel } from '@/components/invoice/ClientContactPanel'
import { COUNTRY_TAX_CONFIG } from '@/lib/tax/config'
import type { InvoiceStatus, Currency } from '@/types/database'


export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('invoice')
  return { title: t('title') }
}

interface InvoicePageProps {
  params: Promise<{ locale: string; id: string }>
}

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  pending:       'bg-violet-500/15 text-violet-300 border-violet-500/30',
  processing:    'bg-blue-500/15 text-blue-300 border-blue-500/30',
  review_needed: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  approved:      'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejected:      'bg-red-500/15 text-red-400 border-red-500/30',
}

function StatusBadge({ status, label }: { status: InvoiceStatus; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {(status === 'pending' || status === 'processing') && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />
      )}
      {label}
    </span>
  )
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <span className="shrink-0 text-[#888]">{label}</span>
      <span className="text-right font-medium text-[#ededed]">{value}</span>
    </div>
  )
}

export default async function InvoicePage({ params }: InvoicePageProps) {
  const { locale, id } = await params
  const t = await getTranslations('invoice')
  const tCommon = await getTranslations('common')

  const result = await getInvoice(id)
  if (!result) notFound()

  const { invoice, receiptUrl } = result
  const isPDF = invoice.receipt_path?.toLowerCase().endsWith('.pdf') ?? false
  const currency = invoice.currency as Currency
  const statusLabel = t(`status.${invoice.status}`)
  const isAnalyzingOnLoad = invoice.status === 'pending' || invoice.status === 'processing'

  const FAILURE_REASON_LABELS: Record<string, string> = {
    not_invoice:      t('failureReason.not_invoice'),
    image_unclear:    t('failureReason.image_unclear'),
    timeout_8s:       t('failureReason.timeout_8s'),
    parsing_failed:   t('failureReason.parsing_failed'),
    handwritten_only: t('failureReason.handwritten_only'),
  }
  const failureLabel = invoice.failure_reason
    ? (FAILURE_REASON_LABELS[invoice.failure_reason] ?? invoice.failure_reason)
    : null

  // Fiscal breakdown data
  const taxRateLabel = invoice.tax_rate != null
    ? `${Math.round(invoice.tax_rate * 100)} %`
    : null
  const countryConfig = invoice.country_code
    ? COUNTRY_TAX_CONFIG[invoice.country_code]
    : null
  const vatStatusValid = invoice.tax_validation_status === 'valid'

  // Auto-approved badge
  const isAutoApproved =
    invoice.status === 'approved' &&
    invoice.ai_confidence != null &&
    invoice.ai_confidence >= 0.85

  return (
    <div className="space-y-6">
      <AnalysisStatusWrapper invoiceId={invoice.id} initialStatus={invoice.status} />

      {/* ── Back + header ──────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/${locale}/invoices`}
          className="inline-flex items-center gap-1.5 text-sm text-[#888] transition-colors hover:text-[#ededed]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {t('backToInvoices')}
        </Link>

        <div className="flex items-center gap-3">
          <StatusBadge status={invoice.status} label={statusLabel} />
          <InvoiceActions
            invoiceId={invoice.id}
            status={invoice.status}
            receiptUrl={receiptUrl}
            isPDF={isPDF}
          />
        </div>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-[#ededed]">
          {invoice.vendor_name ?? t('title')}
          {invoice.invoice_number && (
            <span className="ml-2 text-sm font-normal text-[#888]">#{invoice.invoice_number}</span>
          )}
        </h1>
        {isAutoApproved && (
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {t('fiscal.autoApproved')}
          </span>
        )}
      </div>

      {/* ── Main grid ─────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">

        {/* ── Receipt preview ─────────────────── (2/5) */}
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111]">
            <div className="border-b border-[#2a2a2a] px-4 py-3">
              <p className="text-xs font-medium text-[#888]">{t('receiptPreview')}</p>
            </div>
            {receiptUrl && !isPDF ? (
              <div className="relative aspect-[3/4] w-full">
                <Image src={receiptUrl} alt={t('receiptPreview')} fill unoptimized className="object-contain p-2" />
              </div>
            ) : receiptUrl && isPDF ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12">
                <svg viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
                  <path d="M14 2v6h6M8 13h8M8 17h5" />
                </svg>
                <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                  className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-600">
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

        {/* ── Right column ────────────────────── (3/5) */}
        <div className="space-y-4 lg:col-span-3">

          {/* ── Fiscal breakdown ────────────────────── */}
          {invoice.total_cents != null && !isAnalyzingOnLoad && (
            <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111]">
              <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-3">
                <p className="text-xs font-medium text-[#888]">{t('fiscal.title')}</p>
                {countryConfig && (
                  <span className="flex items-center gap-1.5 text-xs text-[#555]">
                    <span aria-hidden="true">{countryConfig.flag}</span>
                    {countryConfig.name} · {countryConfig.taxIdLabel}
                  </span>
                )}
              </div>
              <div className="px-4 py-3 space-y-2">
                {/* Base */}
                {invoice.subtotal_cents != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#888]">{t('fiscal.base')}</span>
                    <span className="font-medium text-[#ededed]">
                      {formatCurrency(invoice.subtotal_cents, currency, locale)}
                    </span>
                  </div>
                )}
                {/* Tax */}
                {invoice.tax_cents != null && !invoice.is_reverse_charge && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-[#888]">
                      {t('fiscal.taxAmount', { rate: taxRateLabel ?? '?' })}
                      {taxRateLabel && (
                        <span className={`rounded px-1 py-0.5 text-[10px] font-medium ${vatStatusValid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          {vatStatusValid ? t('fiscal.validRate') : t('fiscal.discrepancyRate')}
                        </span>
                      )}
                    </span>
                    <span className="font-medium text-[#ededed]">
                      {formatCurrency(invoice.tax_cents, currency, locale)}
                    </span>
                  </div>
                )}
                {/* Reverse charge note */}
                {invoice.is_reverse_charge && (
                  <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
                    {t('fiscal.reverseChargeNote')}
                  </p>
                )}
                {/* Separator + Total */}
                <div className="mt-1 border-t border-[#2a2a2a] pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#ededed]">{t('fiscal.total')}</span>
                    <span className="text-lg font-bold text-violet-300">
                      {formatCurrency(invoice.total_cents, currency, locale)}
                    </span>
                  </div>
                  {invoice.due_date && (
                    <p className="mt-1 text-xs text-[#888]">
                      {t('details.dueDate')}: <span className="font-medium text-[#ededed]">{formatDate(invoice.due_date, locale)}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Client contact panel ────────────────── */}
          <ClientContactPanel
            clientName={invoice.client_name}
            clientEmail={invoice.client_email}
            clientPhone={invoice.client_phone}
            clientTaxId={invoice.client_tax_id}
            invoiceNumber={invoice.invoice_number}
            totalCents={invoice.total_cents}
            currency={currency}
            dueDate={invoice.due_date}
            locale={locale}
          />

          {/* ── Extracted data ──────────────────────── */}
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111]">
            <div className="border-b border-[#2a2a2a] px-4 py-3">
              <p className="text-xs font-medium text-[#888]">{t('extractedData')}</p>
            </div>
            <div className="divide-y divide-[#1e1e1e] px-4">
              <DetailRow label={t('details.vendor')} value={invoice.vendor_name} />
              <DetailRow label={t('details.vendorTaxId')} value={invoice.vendor_tax_id} />
              <DetailRow label={t('details.invoiceNumber')} value={invoice.invoice_number} />
              <DetailRow label={t('details.date')} value={invoice.invoice_date ? formatDate(invoice.invoice_date, locale) : null} />
              <DetailRow label={t('details.dueDate')} value={invoice.due_date ? formatDate(invoice.due_date, locale) : null} />
              <DetailRow label={t('details.subtotal')} value={invoice.subtotal_cents != null ? formatCurrency(invoice.subtotal_cents, currency, locale) : null} />
              <DetailRow label={t('details.tax')} value={invoice.tax_cents != null ? formatCurrency(invoice.tax_cents, currency, locale) : null} />
              <DetailRow label={t('details.total')} value={invoice.total_cents != null ? formatCurrency(invoice.total_cents, currency, locale) : null} />
              {invoice.ai_confidence != null && (
                <DetailRow label={t('details.confidence')} value={`${Math.round(invoice.ai_confidence * 100)} %`} />
              )}
            </div>
            {!invoice.vendor_name && !invoice.total_cents && !invoice.invoice_number && (
              <div className="px-4 py-6 text-center text-sm text-[#555]">
                {isAnalyzingOnLoad ? t('dataNotYetAvailable') : t('noDataExtracted')}
              </div>
            )}
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="rounded-xl border border-[#2a2a2a] bg-[#111] px-4 py-3">
              <p className="mb-1 text-xs font-medium text-[#888]">{tCommon('notes')}</p>
              <p className="text-sm text-[#ededed]">{invoice.notes}</p>
            </div>
          )}

          {/* Failure reason */}
          {failureLabel && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <p className="mb-0.5 text-xs font-medium text-amber-400">{t('failureReason.title')}</p>
              <p className="text-sm text-[#888]">{failureLabel}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
