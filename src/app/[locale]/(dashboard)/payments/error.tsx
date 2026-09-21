'use client'

import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/Button'

export default function PaymentsError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('common')
  return (
    <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
      <p className="text-sm text-red-300">{t('error')}</p>
      <Button className="mt-3" size="sm" variant="ghost" onClick={reset}>
        {t('retry')}
      </Button>
    </div>
  )
}
