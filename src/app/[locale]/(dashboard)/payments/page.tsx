import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { QueueView } from '@/components/payments/QueueView'
import { businessToday } from '@/lib/payments/dates'
import { buildQueue } from '@/lib/payments/queue'
import { loadWorkspace } from '@/lib/payments/repository'

import { requireSession } from './session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('payments')
  return { title: t('title') }
}

export default async function PaymentQueuePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { supabase, user } = await requireSession(locale)
  const { workspace, settings } = await loadWorkspace(supabase, user.id)

  // Decided on every visit, from current data: nothing stale is ever shown as payable.
  const now = new Date()
  const queue = buildQueue(workspace, now, businessToday(now))

  return (
    <QueueView
      queue={queue}
      readOnly={false}
      settingsMissing={!settings}
      basePath={`/${locale}/payments`}
      invoiceBase={`/${locale}/invoices`}
    />
  )
}
