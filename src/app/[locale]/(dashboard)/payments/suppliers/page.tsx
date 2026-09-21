import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { SupplierAccounts } from '@/components/payments/SupplierAccounts'
import { loadWorkspace } from '@/lib/payments/repository'

import { requireSession } from '../session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('payments.suppliers')
  return { title: t('title') }
}

export default async function SuppliersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('payments.suppliers')
  const { supabase, user } = await requireSession(locale)
  const { accounts } = await loadWorkspace(supabase, user.id)

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm leading-relaxed text-[#888]">{t('intro')}</p>
      <SupplierAccounts
        readOnly={false}
        now={new Date().toISOString()}
        accounts={accounts.map((a) => ({
          id: a.id,
          supplier_key: a.supplier_key,
          supplier_name: a.supplier_name,
          iban: a.iban,
          status: a.status,
          is_change: a.is_change,
          source: a.source,
          registered_at: a.registered_at,
          verified_at: a.verified_at,
          verification_channel: a.verification_channel,
          verification_contact: a.verification_contact,
          cooling_off_until: a.cooling_off_until,
          rejection_reason: a.rejection_reason,
          closed_at: a.closed_at,
        }))}
      />
    </div>
  )
}
