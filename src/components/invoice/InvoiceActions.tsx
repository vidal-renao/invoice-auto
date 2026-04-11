'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import Image from 'next/image'
import { deleteInvoice, updateInvoiceStatus } from '@/lib/actions/invoices'
import type { InvoiceStatus } from '@/types/database'

interface InvoiceActionsProps {
  invoiceId: string
  status: InvoiceStatus
  receiptUrl: string | null
  isPDF: boolean
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function ZoomIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function BanIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InvoiceActions({ invoiceId, status, receiptUrl, isPDF }: InvoiceActionsProps) {
  const t = useTranslations('invoice')
  const locale = useLocale()
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [statusError, setStatusError] = useState(false)

  const [showZoom, setShowZoom] = useState(false)

  // Close overlays on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowZoom(false)
        if (!isDeleting) setShowDeleteModal(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isDeleting])

  // Prevent body scroll while any overlay is open
  useEffect(() => {
    const open = showZoom || showDeleteModal
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [showZoom, showDeleteModal])

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

  async function handleStatusUpdate(newStatus: 'approved' | 'rejected') {
    setIsUpdatingStatus(true)
    setStatusError(false)
    const result = await updateInvoiceStatus(invoiceId, newStatus)
    if (result.error) {
      setStatusError(true)
      setIsUpdatingStatus(false)
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* ── Approve / Reject — only for review_needed ──────── */}
        {status === 'review_needed' && (
          <>
            <button
              onClick={() => handleStatusUpdate('approved')}
              disabled={isUpdatingStatus}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:pointer-events-none disabled:opacity-50"
            >
              <CheckIcon className="h-3.5 w-3.5" />
              {t('approve')}
            </button>
            <button
              onClick={() => handleStatusUpdate('rejected')}
              disabled={isUpdatingStatus}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:pointer-events-none disabled:opacity-50"
            >
              <BanIcon className="h-3.5 w-3.5" />
              {t('reject')}
            </button>
          </>
        )}

        {/* ── Zoom — images only ─────────────────────────────── */}
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

        {/* ── Delete ─────────────────────────────────────────── */}
        <button
          onClick={() => { setShowDeleteModal(true); setDeleteError(false) }}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#2a2a2a] px-3 py-1.5 text-sm text-[#888] transition-colors hover:border-red-500/30 hover:text-red-400"
        >
          <TrashIcon className="h-4 w-4" />
          {t('delete')}
        </button>
      </div>

      {/* Status update error */}
      {statusError && (
        <p role="alert" className="mt-1 text-xs text-red-400">{t('statusError')}</p>
      )}

      {/* ── Delete confirmation modal ──────────────────────────── */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => { if (!isDeleting) setShowDeleteModal(false) }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm rounded-xl border border-[#2a2a2a] bg-[#111] p-6 shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-[#ededed]">
              {t('deleteConfirmTitle')}
            </h3>
            <p className="mt-1.5 text-sm text-[#888]">{t('deleteConfirmDesc')}</p>

            {deleteError && (
              <p role="alert" className="mt-3 text-sm text-red-400">{t('deleteError')}</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteError(false) }}
                disabled={isDeleting}
                className="flex-1 rounded-md border border-[#2a2a2a] px-4 py-2 text-sm text-[#888] transition-colors hover:border-[#444] hover:text-[#ededed] disabled:opacity-50"
              >
                {t('cancelDelete')}
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
              >
                {isDeleting ? '…' : t('deleteConfirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Image zoom overlay ─────────────────────────────────── */}
      {showZoom && receiptUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-4"
          onClick={() => setShowZoom(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t('zoomImage')}
        >
          <button
            onClick={() => setShowZoom(false)}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] text-[#888] transition-colors hover:bg-[#2a2a2a] hover:text-[#ededed]"
            aria-label={t('closeZoom')}
          >
            <XIcon className="h-4 w-4" />
          </button>
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
