import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { AuditTable } from '@/components/payments/AuditTable'
import { listAudit } from '@/lib/payments/repository'

import { requireSession } from '../session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('payments.audit')
  return { title: t('title') }
}

export default async function AuditPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('payments.audit')
  const { supabase, user } = await requireSession(locale)
  const rows = await listAudit(supabase, user.id)

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm leading-relaxed text-[#888]">{t('intro')}</p>
      <AuditTable rows={rows} />
    </div>
  )
}
