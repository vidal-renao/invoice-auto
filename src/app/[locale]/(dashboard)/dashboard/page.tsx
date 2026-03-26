import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import {
  getDashboardStats,
  listInvoices,
  getVatBreakdown,
} from '@/lib/actions/invoices'
import type { Profile, InvoiceStatus, Currency } from '@/types/database'
import { StatCard } from '@/components/dashboard/StatCard'
import { ScanTicketButton } from '@/components/dashboard/ScanTicketButton'
import { VatByCountryCard } from '@/components/dashboard/VatByCountryCard'
import { FiscalValidationButton } from '@/components/dashboard/FiscalValidationButton'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/utils'

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  pending:       'bg-violet-500/15 text-violet-300 border-violet-500/30',
  processing:    'bg-blue-500/15 text-blue-300 border-blue-500/30',
  review_needed: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  approved:      'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejected:      'bg-red-500/15 text-red-400 border-red-500/30',
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard')
  return { title: t('title') }
}

interface DashboardPageProps {
  params: Promise<{ locale: string }>
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params
  const t = await getTranslations('dashboard')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/${locale}/login`)

  const [profileResult, stats, recentInvoices, vatBreakdown] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single() as unknown as Promise<{ data: Profile | null; error: unknown }>,
    getDashboardStats(),
    listInvoices(),
    getVatBreakdown(),
  ])

  const profile = profileResult.data
  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? ''
  const currency = profile?.country === 'CH' ? 'CHF' : 'EUR'

  const isEmpty = stats.total === 0

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#ededed]">
            {t('welcome', { name: displayName })}
          </h1>
          {profile?.company_name && (
            <p className="mt-0.5 text-sm text-[#888]">{profile.company_name}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <FiscalValidationButton />
          <ScanTicketButton variant="header" />
        </div>
      </div>

      {/* ── Stats grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t('stats.totalInvoices')}
          value={stats.total.toString()}
        />
        <StatCard
          label={t('stats.pending')}
          value={formatCurrency(stats.pendingCents, currency, locale)}
          trend="neutral"
        />
        <StatCard
          label={t('stats.paid')}
          value={formatCurrency(stats.paidThisMonthCents, currency, locale)}
          trend={stats.paidThisMonthCents > 0 ? 'up' : 'neutral'}
        />
        <StatCard
          label={t('stats.overdue')}
          value={stats.overdue.toString()}
          trend={stats.overdue > 0 ? 'down' : 'neutral'}
        />
      </div>

      {/* ── CFO: VAT breakdown by country & quarter ────────────── */}
      <VatByCountryCard rows={vatBreakdown} locale={locale} currency={currency} />

      {/* ── Recent invoices / Empty state ──────────────────────── */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-[#ededed]">
            {t('recentInvoices')}
          </h2>
        </CardHeader>

        <CardContent>
          {isEmpty ? (
            /* ── Hero empty state with prominent Scan CTA ─────── */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div
                className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]"
                aria-hidden="true"
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#555"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
                  <path d="M14 2v6h6" />
                  <path d="M8 13h8M8 17h5" />
                </svg>
              </div>

              <p className="text-base font-semibold text-[#ededed]">
                {t('empty.title')}
              </p>
              <p className="mt-1 max-w-xs text-sm text-[#888]">
                {t('empty.description')}
              </p>

              <div className="mt-8">
                <ScanTicketButton variant="hero" />
              </div>
            </div>
          ) : (
            /* ── Recent invoices table (5 most recent) ─────────── */
            <div className="-mx-4 -mb-4">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-[#1e1e1e]">
                  {recentInvoices.slice(0, 5).map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="group transition-colors hover:bg-[#161616]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/${locale}/invoices/${invoice.id}`}
                          className="block font-medium text-[#ededed] group-hover:text-white"
                        >
                          {/* Country flag if available */}
                          {invoice.country_code && (
                            <span className="mr-1.5 text-sm" aria-hidden="true">
                              {getCountryFlag(invoice.country_code)}
                            </span>
                          )}
                          {invoice.vendor_name ?? (
                            <span className="text-[#555]">—</span>
                          )}
                        </Link>
                        <p className="mt-0.5 text-xs text-[#555]">
                          {invoice.invoice_date
                            ? formatDate(invoice.invoice_date, locale)
                            : invoice.created_at
                              ? formatDate(invoice.created_at, locale)
                              : '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-medium text-[#ededed]">
                          {invoice.total_cents != null
                            ? formatCurrency(
                                invoice.total_cents,
                                (invoice.currency as Currency) ?? currency,
                                locale
                              )
                            : '—'}
                        </p>
                        <div className="mt-0.5 flex items-center justify-end gap-1.5">
                          {/* Reverse charge badge */}
                          {invoice.is_reverse_charge && (
                            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                              RC
                            </span>
                          )}
                          {/* VAT discrepancy badge */}
                          {invoice.tax_validation_status === 'discrepancy' && (
                            <span
                              className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400"
                              title={t('stats.vatDiscrepancy')}
                            >
                              ⚠
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[invoice.status]}`}
                          >
                            {invoice.status === 'pending' || invoice.status === 'processing'
                              ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />
                              : null}
                            {invoice.status}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {recentInvoices.length > 5 && (
                <div className="border-t border-[#1e1e1e] px-4 py-3">
                  <Link
                    href={`/${locale}/invoices`}
                    className="text-xs text-[#888] transition-colors hover:text-violet-400"
                  >
                    {t('viewAllInvoices')} →
                  </Link>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FLAG_MAP: Record<string, string> = {
  ES: '🇪🇸', CH: '🇨🇭', DE: '🇩🇪', FR: '🇫🇷', IT: '🇮🇹',
  GB: '🇬🇧', NL: '🇳🇱', PT: '🇵🇹', BE: '🇧🇪', AT: '🇦🇹',
  PL: '🇵🇱', SE: '🇸🇪', DK: '🇩🇰', NO: '🇳🇴', IE: '🇮🇪', LU: '🇱🇺',
}

function getCountryFlag(code: string): string {
  return FLAG_MAP[code.toUpperCase()] ?? '🏳️'
}
