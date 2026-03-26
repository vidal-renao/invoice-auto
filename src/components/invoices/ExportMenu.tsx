'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface ExportMenuProps {
  /** Base export URL including any filter params (e.g. /api/invoices/export?status=approved) */
  exportHref: string
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function DownloadIcon({ className }: { className?: string }) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function ChevronIcon({ className }: { className?: string }) {
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
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Dropdown export menu. CSV is fully functional.
 * XLSX and PDF slots are prepared but require additional dependencies
 * (exceljs / pdfmake) — they display a "coming soon" badge and return
 * HTTP 501 from the API until those deps are added.
 */
export function ExportMenu({ exportHref }: ExportMenuProps) {
  const t = useTranslations('invoices')
  const [open, setOpen] = useState(false)

  const sep = exportHref.includes('?') ? '&' : '?'
  const csvHref = `${exportHref}${sep}format=csv`
  const xlsxHref = `${exportHref}${sep}format=xlsx`

  return (
    <div
      className="relative"
      onBlur={(e) => {
        // Close only when focus leaves the entire dropdown container
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setOpen(false)
        }
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors',
          open
            ? 'border-[#444] text-[#ededed]'
            : 'border-[#2a2a2a] text-[#888] hover:border-[#444] hover:text-[#ededed]'
        )}
      >
        <DownloadIcon className="h-4 w-4" />
        {t('export')}
        <ChevronIcon
          className={cn('h-3 w-3 transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[168px] overflow-hidden rounded-md border border-[#2a2a2a] bg-[#111] shadow-xl">
          {/* CSV — fully functional */}
          <a
            href={csvHref}
            download
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#ededed] transition-colors hover:bg-[#1a1a1a]"
          >
            {t('exportCsv')}
          </a>

          {/* XLSX — prepared, pending exceljs dependency */}
          <a
            href={xlsxHref}
            download
            onClick={() => setOpen(false)}
            className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-[#555]"
            aria-disabled="true"
            tabIndex={-1}
          >
            {t('exportXlsx')}
            <span className="rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-500/60">
              {t('exportSoon')}
            </span>
          </a>

          {/* PDF — prepared, pending pdfmake/pdf-lib dependency */}
          <div
            className="flex cursor-not-allowed items-center justify-between gap-2 px-4 py-2.5 text-sm text-[#555]"
            aria-disabled="true"
          >
            {t('exportPdf')}
            <span className="rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-500/60">
              {t('exportSoon')}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
