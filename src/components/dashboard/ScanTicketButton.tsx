'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { createInvoiceRecord } from '@/lib/actions/invoices'
import { analyzeReceipt } from '@/lib/actions/ai'
import { cn } from '@/lib/utils'

type UploadStatus = 'idle' | 'uploading' | 'analyzing' | 'error' | 'sizeError' | 'authError'

const ACCEPTED = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf'
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

// ── Icons ─────────────────────────────────────────────────────────────────────

function ScanIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9V5a2 2 0 0 1 2-2h4" />
      <path d="M15 3h4a2 2 0 0 1 2 2v4" />
      <path d="M21 15v4a2 2 0 0 1-2 2h-4" />
      <path d="M9 21H5a2 2 0 0 1-2-2v-4" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  )
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ── Progress bar (hero variant only) ─────────────────────────────────────────

function UploadProgress({ progress }: { progress: number }) {
  return (
    <div className="w-64 space-y-1" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-1 w-full overflow-hidden rounded-full bg-[#2a2a2a]">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-center text-xs tabular-nums text-[#555]">{progress} %</p>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ScanTicketButtonProps {
  /** 'hero' — large centered CTA in empty state | 'header' — compact button in page header */
  variant?: 'hero' | 'header'
}

export function ScanTicketButton({ variant = 'hero' }: ScanTicketButtonProps) {
  const t = useTranslations('scan')
  const locale = useLocale()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState(0)

  // ── Animated upload progress (natural-feel ramp-up to 85%, completes on success) ──
  useEffect(() => {
    if (status !== 'uploading') return

    const id = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) return prev
        const step = Math.random() * 8 + 2 // 2–10 % per tick
        return Math.min(prev + step, 85)
      })
    }, 300)

    return () => clearInterval(id)
  }, [status])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_BYTES) {
      setStatus('sizeError')
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    setStatus('uploading')
    setProgress(0)

    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error('[ScanTicket] getUser() returned null — upload aborted')
      setStatus('authError')
      return
    }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`

    // ── Upload ────────────────────────────────────────────────────────────
    const { error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(path, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      // Surface the raw message in the console for debugging
      console.error('[ScanTicket] Upload failed:', uploadError.message, uploadError)
      setStatus('error')
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    // Flash 100% briefly before switching to analyzing state
    setProgress(100)

    // ── Create DB record ──────────────────────────────────────────────────
    const invoiceId = await createInvoiceRecord(path)
    if (!invoiceId) {
      setStatus('error')
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    // ── AI analysis ───────────────────────────────────────────────────────
    setStatus('analyzing')
    try {
      await analyzeReceipt(invoiceId)
    } catch (err) {
      // Analysis failure is non-fatal — invoice page shows pending state
      console.error('[ScanTicket] Analysis error:', err)
    }

    router.push(`/${locale}/invoices/${invoiceId}`)
  }

  const isBusy = status === 'uploading' || status === 'analyzing'

  function buttonLabel() {
    if (status === 'uploading') return t('uploading')
    if (status === 'analyzing') return t('analyzing')
    return t('cta')
  }

  // ── Header variant ────────────────────────────────────────────────────────
  if (variant === 'header') {
    return (
      <div className="flex flex-col items-end gap-1">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="sr-only"
          onChange={handleFileChange}
          aria-label={t('inputLabel')}
          tabIndex={-1}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isBusy}
          aria-busy={isBusy}
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
            'bg-violet-700 text-white transition-colors hover:bg-violet-600',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
            'focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]',
            'disabled:pointer-events-none disabled:opacity-50'
          )}
        >
          {isBusy ? <Spinner className="h-4 w-4" /> : <ScanIcon className="h-4 w-4" />}
          {buttonLabel()}
        </button>

        {/* Compact progress bar */}
        {status === 'uploading' && (
          <div
            className="h-0.5 w-full overflow-hidden rounded-full bg-[#2a2a2a]"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {status === 'error' && (
          <p role="alert" className="text-xs text-red-400">{t('uploadError')}</p>
        )}
        {status === 'sizeError' && (
          <p role="alert" className="text-xs text-red-400">{t('sizeError')}</p>
        )}
        {status === 'authError' && (
          <p role="alert" className="text-xs text-red-400">{t('authError')}</p>
        )}
      </div>
    )
  }

  // ── Hero variant ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="sr-only"
        onChange={handleFileChange}
        aria-label={t('inputLabel')}
        tabIndex={-1}
      />

      <button
        onClick={() => inputRef.current?.click()}
        disabled={isBusy}
        aria-busy={isBusy}
        className={cn(
          'group relative flex items-center gap-3 rounded-xl px-8 py-4',
          'bg-violet-700 text-white',
          'hover:bg-violet-600 active:bg-violet-800',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]',
          'transition-all duration-150',
          'disabled:pointer-events-none disabled:opacity-60',
          'hover:shadow-[0_0_24px_rgba(124,58,237,0.35)]'
        )}
      >
        {isBusy ? (
          <Spinner className="h-6 w-6 shrink-0" />
        ) : (
          <ScanIcon className="h-6 w-6 shrink-0 transition-transform duration-150 group-hover:scale-110" />
        )}
        <span className="text-base font-semibold">{buttonLabel()}</span>
      </button>

      {/* Upload progress bar */}
      {status === 'uploading' && <UploadProgress progress={progress} />}

      {/* Hint (only when idle) */}
      {status === 'idle' && <p className="text-xs text-[#888]">{t('hint')}</p>}

      {/* Analyzing hint */}
      {status === 'analyzing' && (
        <p className="text-xs text-[#555]">{t('analyzingHint')}</p>
      )}

      {status === 'error' && (
        <p role="alert" className="text-xs text-red-400">{t('uploadError')}</p>
      )}
      {status === 'sizeError' && (
        <p role="alert" className="text-xs text-red-400">{t('sizeError')}</p>
      )}
      {status === 'authError' && (
        <p role="alert" className="text-xs text-red-400">{t('authError')}</p>
      )}
    </div>
  )
}
