'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import Image from 'next/image'
import { deleteInvoice } from '@/lib/actions/invoices'

interface InvoiceActionsProps {
  invoiceId: string
  /** Short-lived signed URL for the receipt file, or null if unavailable. */
  receiptUrl: string | null
  /** True when the receipt is a PDF (zoom not available for PDFs). */
  isPDF: boolean
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function ZoomIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InvoiceActions({ invoiceId, receiptUrl, isPDF }: InvoiceActionsProps) {
  const t = useTranslations('invoice')
  const locale = useLocale()
  const router = useRouter()

  const [showConfirm, setShowConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  const [showZoom, setShowZoom] = useState(false)

  // Close zoom overlay on Escape key
  useEffect(() => {
    if (!showZoom) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowZoom(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showZoom])

  // Prevent body scroll while zoom is open
  useEffect(() => {
    document.body.style.overflow = showZoom ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [showZoom])

  async function handleDelete() {
    setIsDeleting(true)
    setDeleteError(false)
    const result = await deleteInvoice(invoiceId)
    if (result.error) {
      setDeleteError(true)
      setIsDeleting(false)
      return
    }
    router.push(`/${locale}/invoices`)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* ── Zoom button — images only ──────────────────────── */}
        {receiptUrl && !isPDF && (
          <button
            onClick={() => setShowZoom(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#2a2a2a] px-3 py-1.5 text-sm text-[#888] transition-colors hover:border-[#444] hover:text-[#ededed]"
            aria-label={t('zoomImage')}
          >
            <ZoomIcon className="h-4 w-4" />
            {t('zoomImage')}
          </button>
        )}

        {/* ── Delete ────────────────────────────────────────── */}
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#2a2a2a] px-3 py-1.5 text-sm text-[#888] transition-colors hover:border-red-500/30 hover:text-red-400"
          >
            <TrashIcon className="h-4 w-4" />
            {t('delete')}
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-1.5">
            <span className="text-xs text-red-300">{t('deleteConfirmTitle')}</span>
            <button
              onClick={() => { setShowConfirm(false); setDeleteError(false) }}
              disabled={isDeleting}
              className="text-xs text-[#888] transition-colors hover:text-[#ededed] disabled:opacity-50"
            >
              {t('cancelDelete')}
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-xs font-medium text-red-400 transition-colors hover:text-red-300 disabled:opacity-50"
            >
              {isDeleting ? '…' : t('deleteConfirmBtn')}
            </button>
          </div>
        )}
      </div>

      {deleteError && (
        <p role="alert" className="mt-1 text-xs text-red-400">
          {t('deleteError')}
        </p>
      )}

      {/* ── Image zoom overlay ────────────────────────────────── */}
      {showZoom && receiptUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-4"
          onClick={() => setShowZoom(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t('zoomImage')}
        >
          {/* Close button */}
          <button
            onClick={() => setShowZoom(false)}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] text-[#888] transition-colors hover:bg-[#2a2a2a] hover:text-[#ededed]"
            aria-label={t('closeZoom')}
          >
            <XIcon className="h-4 w-4" />
          </button>

          {/* Image container — stops click from bubbling to overlay */}
          <div
            className="relative max-h-[90vh] w-full max-w-3xl"
            style={{ aspectRatio: '3/4' }}
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={receiptUrl}
              alt={t('receiptPreview')}
              fill
              unoptimized
              className="rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </>
  )
}
