import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { listCustomers } from '@/lib/actions/billing'
import { NewCustomerForm } from '@/components/billing/NewCustomerForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('billing')
  return { title: t('customers') }
}

export default async function CustomersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('billing')
  const customers = await listCustomers()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">{t('customers')}</h1>
        <Link
          href={`/${locale}/billing`}
          className="flex min-h-11 items-center rounded-md px-2 text-sm text-muted underline underline-offset-2 transition-colors hover:text-ink"
        >
          {t('back')}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <NewCustomerForm />

        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {customers.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-faint">{t('noCustomers')}</p>
          ) : (
            <ul className="divide-y divide-elevated-2">
              {customers.map((c) => (
                <li key={c.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-ink">{c.name}</p>
                  <p className="text-xs text-muted">
                    {c.country} · {c.tax_id ?? '—'} · {t(`customerForm.${c.kind}`)} ·{' '}
                    {t('dueIn', { days: c.payment_terms_days })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
