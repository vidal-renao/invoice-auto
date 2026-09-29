import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { listCustomers } from '@/lib/actions/billing'
import { NewInvoiceForm } from '@/components/billing/NewInvoiceForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('billing')
  return { title: t('newInvoice') }
}

export default async function NewInvoicePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('billing')
  const customers = await listCustomers()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">{t('newInvoice')}</h1>
        <Link
          href={`/${locale}/billing`}
          className="flex min-h-11 items-center rounded-md px-2 text-sm text-muted underline underline-offset-2 transition-colors hover:text-ink"
        >
          {t('back')}
        </Link>
      </div>

      {customers.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center">
          <p className="text-sm font-medium text-ink">{t('needCustomer.title')}</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            {t('needCustomer.description')}
          </p>
          <Link
            href={`/${locale}/billing/customers`}
            className="mt-6 inline-flex min-h-11 items-center rounded-md bg-accent px-5 text-sm font-semibold text-white"
          >
            {t('needCustomer.cta')}
          </Link>
        </div>
      ) : (
        <NewInvoiceForm customers={customers} defaultSeries="FA" />
      )}
    </div>
  )
}
