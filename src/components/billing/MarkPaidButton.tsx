'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { markInvoicePaid } from '@/lib/actions/billing'
import { Button } from '@/components/ui/Button'

/** Marcar cobrada es lo único que cambia en una factura ya emitida. */
export function MarkPaidButton({ id }: { id: string }) {
  const t = useTranslations('billing')
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [error, setError] = useState(false)

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span role="alert" className="text-xs text-danger-text">
          {t('errors.db')}
        </span>
      )}
      <Button
        size="sm"
        loading={pendiente}
        onClick={() =>
          startTransition(async () => {
            setError(false)
            const r = await markInvoicePaid(id)
            if (r.ok) router.refresh()
            else setError(true)
          })
        }
      >
        {t('markPaid')}
      </Button>
    </div>
  )
}
