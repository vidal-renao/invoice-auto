'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface InvoicePollerProps {
  /** When true, poll every 3 s and refresh the page to re-fetch server data. */
  isPending: boolean
}

/**
 * Invisible client component that auto-refreshes the invoice detail page
 * while the AI analysis is in progress.
 *
 * Uses router.refresh() inside startTransition so the refresh is treated as
 * a low-priority update. This prevents the poll from racing with user-initiated
 * navigations (e.g. clicking "Back") — the user's action always wins and the
 * pending transition is abandoned rather than interrupting the navigation.
 *
 * router is intentionally excluded from the effect deps: Next.js guarantees
 * a stable router singleton, and adding it would reset the interval on every
 * re-render triggered by the very refresh we're scheduling.
 */
export function InvoicePoller({ isPending }: InvoicePollerProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (!isPending) return
    const id = setInterval(() => {
      startTransition(() => router.refresh())
    }, 3_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending])

  return null
}
