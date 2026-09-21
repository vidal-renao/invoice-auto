'use client'

/**
 * AnalysisStatusWrapper — isolated client component for AI analysis state.
 *
 * Architecture rationale
 * ──────────────────────
 * The previous approach (InvoicePoller + router.refresh every 3 s) caused a
 * visible "restart" effect because router.refresh() re-runs the Server Component,
 * which destroys and recreates the spinner DOM node — resetting its CSS animation
 * on every tick.
 *
 * This component fixes the root cause:
 *   • Spinner lives entirely in client state → never destroyed during polling.
 *   • Polling calls getInvoiceStatus() (Server Action), NOT router.refresh().
 *     Each poll is a lightweight single-row SELECT — no full page re-render.
 *   • When the analysis finishes, ONE startTransition(router.refresh()) loads
 *     the final invoice data. After that the component returns null and stops.
 *
 * Stale-closure safety
 * ────────────────────
 * The async poll() callback captures statusRef (a mutable ref that always holds
 * the latest status) rather than the `status` state value at the time the effect
 * was created. This prevents double-updates if two polls overlap.
 */

import { useState, useEffect, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getInvoiceStatus } from '@/lib/actions/invoices'
import type { InvoiceStatus } from '@/types/database'

const POLL_INTERVAL_MS = 3_000

interface AnalysisStatusWrapperProps {
  invoiceId: string
  /** Status read from the DB at page render time. */
  initialStatus: InvoiceStatus
}

export function AnalysisStatusWrapper({
  invoiceId,
  initialStatus,
}: AnalysisStatusWrapperProps) {
  const t = useTranslations('invoice')
  const router = useRouter()
  const [, startTransition] = useTransition()

  // Client-side status state — independent from server re-renders
  const [status, setStatus] = useState<InvoiceStatus>(initialStatus)

  // Ref always reflects the latest status inside async poll callbacks
  // (synced in an effect: writing a ref during render is not allowed in React 19)
  const statusRef = useRef<InvoiceStatus>(status)
  useEffect(() => {
    statusRef.current = status
  }, [status])

  const isAnalyzing = status === 'pending' || status === 'processing'

  useEffect(() => {
    if (!isAnalyzing) return

    let cancelled = false

    async function poll() {
      if (cancelled) return

      const next = await getInvoiceStatus(invoiceId)

      console.log(
        `[AnalysisStatusWrapper] poll invoiceId=${invoiceId} ` +
          `prev=${statusRef.current} next=${next ?? 'null'}`
      )

      if (cancelled || !next || next === statusRef.current) return

      setStatus(next)

      const isDone = next !== 'pending' && next !== 'processing'
      if (isDone) {
        console.log(
          `[AnalysisStatusWrapper] Analysis complete (${next}) — ` +
            `triggering single router.refresh() to load final data`
        )
        // startTransition ensures this refresh is interruptible by user actions
        startTransition(() => router.refresh())
      }
    }

    console.log(`[AnalysisStatusWrapper] Polling started — invoiceId=${invoiceId}`)
    const id = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(id)
      console.log(`[AnalysisStatusWrapper] Polling stopped — invoiceId=${invoiceId}`)
    }

    // router and startTransition are stable singletons (Next.js / React guarantees).
    // invoiceId is constant on this page.
    // isAnalyzing is the only dep that matters: when it flips to false, cleanup fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, isAnalyzing])

  if (!isAnalyzing) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-4"
    >
      {/* Spinner — lives in client state, animates continuously without resets */}
      <svg
        className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-violet-400"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>

      <div>
        <p className="text-sm font-medium text-violet-300">{t('processingTitle')}</p>
        <p className="mt-0.5 text-xs text-[#888]">{t('processingDesc')}</p>
      </div>
    </div>
  )
}
