'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface InvoicePollerProps {
  /** When true, poll every 3 s and refresh the page to re-fetch server data. */
  isPending: boolean
}

/**
 * Invisible client component that auto-refreshes the invoice detail page
 * while the AI analysis is in progress.
 *
 * Uses router.refresh() to re-run Server Component fetches without a full
 * navigation — the user sees the data update without losing scroll position.
 */
export function InvoicePoller({ isPending }: InvoicePollerProps) {
  const router = useRouter()

  useEffect(() => {
    if (!isPending) return
    const id = setInterval(() => router.refresh(), 3_000)
    return () => clearInterval(id)
  }, [isPending, router])

  return null
}
