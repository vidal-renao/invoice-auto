import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { PaymentSettingsForm } from '@/components/payments/PaymentSettingsForm'
import { formatIban } from '@/lib/payments/iban'
import { loadWorkspace } from '@/lib/payments/repository'
import { DEFAULT_SETTINGS } from '@/lib/payments/types'

import { requireSession } from '../session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('payments.settings')
  return { title: t('title') }
}

export default async function PaymentSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { supabase, user } = await requireSession(locale)
  const { settings } = await loadWorkspace(supabase, user.id)

  const thresholdCents = Number(settings?.review_threshold_cents ?? DEFAULT_SETTINGS.review_threshold_cents)

  return (
    <PaymentSettingsForm
      initial={{
        debtor_name: settings?.debtor_name ?? '',
        debtor_iban: settings ? formatIban(settings.debtor_iban) : '',
        debtor_bic: settings?.debtor_bic ?? '',
        review_threshold: String(Math.round(thresholdCents / 100)),
        cooling_off_hours: String(settings?.cooling_off_hours ?? DEFAULT_SETTINGS.cooling_off_hours),
      }}
    />
  )
}
