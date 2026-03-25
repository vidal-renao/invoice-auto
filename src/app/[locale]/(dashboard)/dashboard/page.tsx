import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getDashboardStats } from '@/lib/actions/invoices'
import type { Profile } from '@/types/database'
import { StatCard } from '@/components/dashboard/StatCard'
import { ScanTicketButton } from '@/components/dashboard/ScanTicketButton'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'

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

  const [profileResult, stats] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single() as unknown as Promise<{ data: Profile | null; error: unknown }>,
    getDashboardStats(),
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

        {/* Compact scan button always in header */}
        <ScanTicketButton variant="header" />
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
              {/* Animated receipt illustration */}
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

              {/* ── THE MAIN CTA ── */}
              <div className="mt-8">
                <ScanTicketButton variant="hero" />
              </div>
            </div>
          ) : (
            /* ── Invoice list placeholder (populated in next sprint) ── */
            <div className="py-4 text-center text-sm text-[#888]">
              {/* Invoice rows will render here */}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
