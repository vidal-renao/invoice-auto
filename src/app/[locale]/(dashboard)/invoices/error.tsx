'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'

/**
 * A failed query used to return an empty array, which on screen is
 * indistinguishable from "no invoice matches these filters". Now it throws, and
 * this says so — otherwise a broken filter looks like an empty account.
 */
export default function InvoicesError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('common')
  const ti = useTranslations('invoices')
  return (
    <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
      <p className="text-sm font-medium text-danger-text">{ti('loadError')}</p>
      <p className="mt-1 text-xs text-muted">{ti('loadErrorHint')}</p>
      <Button className="mt-3" size="sm" variant="ghost" onClick={reset}>
        {t('retry')}
      </Button>
    </div>
  )
}
