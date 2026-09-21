import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { BatchList, type BatchView } from '@/components/payments/BatchList'
import { listBatches } from '@/lib/payments/repository'

import { requireSession } from '../session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('payments.batches')
  return { title: t('title') }
}

export default async function BatchesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('payments.batches')
  const { supabase, user } = await requireSession(locale)
  const { batches, payments } = await listBatches(supabase, user.id)

  const views: BatchView[] = batches.map((b) => {
    const totals = new Map<string, number>()
    for (const p of payments) {
      if (p.batch_id === b.id) totals.set(p.currency, (totals.get(p.currency) ?? 0) + p.amount_cents)
    }
    return {
      id: b.id,
      message_id: b.message_id,
      status: b.status,
      tx_count: b.tx_count,
      created_at: b.created_at,
      executed_at: b.executed_at,
      cancelled_at: b.cancelled_at,
      cancel_reason: b.cancel_reason,
      totals: [...totals.entries()].map(([currency, cents]) => ({ currency, cents })),
    }
  })

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm leading-relaxed text-[#888]">{t('intro')}</p>
      <BatchList batches={views} readOnly={false} downloadBase="/api/payments/batches" />
    </div>
  )
}
