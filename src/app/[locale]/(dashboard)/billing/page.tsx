import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { listIssuedInvoices } from '@/lib/actions/billing'
import { formatCurrency, formatDate } from '@/lib/utils'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav')
  return { title: t('billing') }
}

const ESTADO: Record<string, string> = {
  issued: 'border-amber-500/30 bg-amber-500/15 text-warning-text',
  paid: 'border-emerald-500/30 bg-emerald-500/15 text-success-text',
  cancelled: 'border-line bg-surface-2 text-muted',
}

export default async function BillingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('billing')
  const facturas = await listIssuedInvoices()

  const pendiente = facturas
    .filter((f) => f.status === 'issued')
    .reduce((s, f) => s + f.total_cents, 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/billing/customers`}
            className="flex min-h-11 items-center rounded-md border border-line px-3 text-sm text-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {t('customers')}
          </Link>
          <Link
            href={`/${locale}/billing/new`}
            className="flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {t('newInvoice')}
          </Link>
        </div>
      </div>

      {facturas.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface py-20 text-center">
          <p className="text-sm font-medium text-ink">{t('empty.title')}</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            {t('empty.description')}
          </p>
          <Link
            href={`/${locale}/billing/new`}
            className="mt-6 inline-flex min-h-11 items-center rounded-md bg-accent px-5 text-sm font-semibold text-white"
          >
            {t('newInvoice')}
          </Link>
        </div>
      ) : (
        <>
          {pendiente > 0 && (
            <p className="text-xs text-muted">
              {t('pendingTotal', {
                amount: formatCurrency(pendiente, facturas[0]!.currency, locale),
              })}
            </p>
          )}
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted">{t('reference')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted">{t('customer')}</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted md:table-cell">
                    {t('issueDate')}
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted lg:table-cell">
                    {t('dueDate')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted">{t('total')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-elevated-2">
                {facturas.map((f) => (
                  <tr key={f.id} className="group relative transition-colors hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <Link
                        href={`/${locale}/billing/${f.id}`}
                        className="font-medium text-ink after:absolute after:inset-0"
                      >
                        {f.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{f.customer}</td>
                    <td className="hidden px-4 py-3 text-muted md:table-cell">
                      {formatDate(f.issue_date, locale)}
                    </td>
                    <td className="hidden px-4 py-3 text-muted lg:table-cell">
                      {formatDate(f.due_date, locale)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-ink">
                      {formatCurrency(f.total_cents, f.currency, locale)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${ESTADO[f.status]}`}
                      >
                        {t(`statuses.${f.status}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
