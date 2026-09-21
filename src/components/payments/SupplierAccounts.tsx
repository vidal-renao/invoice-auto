'use client'

import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useId, useState, useTransition } from 'react'

import { Button } from '@/components/ui/Button'
import { rejectSupplierAccount, verifySupplierAccount } from '@/lib/actions/payments'
import { BUSINESS_TIME_ZONE } from '@/lib/payments/dates'
import { formatIban } from '@/lib/payments/iban'
import type { AccountStatus, VerificationChannel } from '@/lib/payments/types'
import { cn } from '@/lib/utils'

export interface AccountView {
  id: string
  supplier_key: string
  supplier_name: string
  iban: string
  status: AccountStatus
  is_change: boolean
  source: 'manual' | 'invoice'
  registered_at: string
  verified_at: string | null
  verification_channel: VerificationChannel | null
  verification_contact: string | null
  cooling_off_until: string | null
  rejection_reason: string | null
  closed_at: string | null
}

const CHANNELS: VerificationChannel[] = ['phone_callback', 'in_person', 'signed_letter', 'bank_confirmation']

const STATUS_STYLE: Record<AccountStatus, string> = {
  pending_verification: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  verified: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  rejected: 'border-red-500/30 bg-red-500/10 text-red-300',
  superseded: 'border-[#333] bg-[#161616] text-[#888]',
}

const inputClass =
  'w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-sm text-[#ededed] placeholder:text-[#808080] focus:border-violet-500 focus:outline-none'

function useDateTime() {
  const locale = useLocale()
  return (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: BUSINESS_TIME_ZONE }).format(new Date(iso))
}

function VerifyForm({ account }: { account: AccountView }) {
  const t = useTranslations('payments')
  const router = useRouter()
  const ids = { channel: useId(), contact: useId(), note: useId(), reason: useId() }
  const [channel, setChannel] = useState<VerificationChannel>('phone_callback')
  const [contact, setContact] = useState('')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const run = (command: () => ReturnType<typeof verifySupplierAccount>) => {
    setError(null)
    startTransition(async () => {
      const result = await command()
      if (!result.ok) {
        setError(t(`errors.${result.error === 'invalid' && result.detail ? result.detail : result.error}`))
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="mt-4 grid gap-4 border-t border-[#1e1e1e] pt-4 lg:grid-cols-[2fr_1fr]">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => verifySupplierAccount({ account_id: account.id, channel, contact, note }))
        }}
      >
        <p className="text-sm font-medium text-[#ededed]">{t('suppliers.verifyTitle')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor={ids.channel} className="block text-xs text-[#aaa]">{t('suppliers.channelLabel')}</label>
            <select id={ids.channel} value={channel} onChange={(e) => setChannel(e.target.value as VerificationChannel)} className={inputClass}>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>{t(`suppliers.channel.${c}`)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor={ids.contact} className="block text-xs text-[#aaa]">{t('suppliers.contactLabel')}</label>
            <input id={ids.contact} value={contact} onChange={(e) => setContact(e.target.value)} required minLength={3} maxLength={200} aria-describedby={`${ids.contact}-hint`} className={inputClass} />
            <p id={`${ids.contact}-hint`} className="text-[11px] leading-snug text-[#888]">{t('suppliers.contactHint')}</p>
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor={ids.note} className="block text-xs text-[#aaa]">{t('suppliers.noteLabel')}</label>
          <input id={ids.note} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={inputClass} />
        </div>
        <Button type="submit" size="sm" loading={pending} disabled={pending || contact.trim().length < 3}>
          {t('suppliers.verify')}
        </Button>
      </form>

      <form
        className="space-y-3 lg:border-l lg:border-[#1e1e1e] lg:pl-4"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => rejectSupplierAccount({ account_id: account.id, reason }))
        }}
      >
        <div className="space-y-1">
          <label htmlFor={ids.reason} className="block text-xs text-[#aaa]">{t('suppliers.rejectLabel')}</label>
          <input id={ids.reason} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={500} className={inputClass} />
        </div>
        <Button type="submit" size="sm" variant="destructive" loading={pending} disabled={pending || reason.trim().length < 3}>
          {t('suppliers.reject')}
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-xs text-red-300 lg:col-span-2">
          {error}
        </p>
      )}
    </div>
  )
}

/** Accounts grouped by supplier: the live one first, its history below. */
export function SupplierAccounts({ accounts, readOnly, now }: { accounts: AccountView[]; readOnly: boolean; now: string }) {
  const t = useTranslations('payments')
  const dateTime = useDateTime()

  if (accounts.length === 0) {
    return <p className="rounded-lg border border-dashed border-[#2a2a2a] px-4 py-8 text-center text-sm text-[#8a8a8a]">{t('suppliers.empty')}</p>
  }

  const bySupplier = new Map<string, AccountView[]>()
  for (const a of accounts) bySupplier.set(a.supplier_key, [...(bySupplier.get(a.supplier_key) ?? []), a])
  const groups = [...bySupplier.values()]
    .map((list) => list.sort((a, b) => b.registered_at.localeCompare(a.registered_at)))
    // Suppliers waiting for a verification first: they block payments.
    .sort((a, b) => Number(b[0]!.status === 'pending_verification') - Number(a[0]!.status === 'pending_verification') || a[0]!.supplier_name.localeCompare(b[0]!.supplier_name))

  return (
    <ul className="space-y-3">
      {groups.map((list) => {
        const [current, ...history] = list
        if (!current) return null
        const cooling = current.cooling_off_until && current.cooling_off_until > now
        return (
          <li key={current.supplier_key} id={`account-${current.id}`} className="scroll-mt-6 rounded-xl border border-[#2a2a2a] bg-[#111] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-[#ededed]">{current.supplier_name}</p>
                <p className="mt-1 font-mono text-sm tracking-wide text-[#ccc]">{formatIban(current.iban)}</p>
                <p className="mt-1 text-xs text-[#888]">
                  {t('suppliers.registered', { date: dateTime(current.registered_at) })} ·{' '}
                  {t(current.source === 'invoice' ? 'suppliers.fromInvoice' : 'suppliers.manual')}
                </p>
                {current.status === 'verified' && current.verified_at && current.verification_channel && (
                  <p className="mt-1 text-xs text-[#888]">
                    {t('suppliers.verifiedBy', {
                      date: dateTime(current.verified_at),
                      channel: t(`suppliers.channel.${current.verification_channel}`),
                      contact: current.verification_contact ?? '—',
                    })}
                  </p>
                )}
                {current.status === 'rejected' && current.rejection_reason && (
                  <p className="mt-1 text-xs text-red-300">{t('suppliers.rejectedBecause', { reason: current.rejection_reason })}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {current.is_change && (
                  <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-xs text-violet-300">{t('suppliers.change')}</span>
                )}
                {cooling && current.cooling_off_until && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-300">
                    {t('suppliers.coolingUntil', { until: dateTime(current.cooling_off_until) })}
                  </span>
                )}
                <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium', STATUS_STYLE[current.status])}>
                  {t(`suppliers.status.${current.status}`)}
                </span>
              </div>
            </div>

            {!readOnly && current.status === 'pending_verification' && <VerifyForm account={current} />}

            {history.length > 0 && (
              <details className="mt-3 border-t border-[#1e1e1e] pt-3">
                <summary className="cursor-pointer text-xs text-[#888] hover:text-[#ededed]">{t('suppliers.history')}</summary>
                <ul className="mt-2 space-y-1">
                  {history.map((h) => (
                    <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-mono text-[#aaa]">{formatIban(h.iban)}</span>
                      <span className="text-[#888]">
                        {t(`suppliers.status.${h.status}`)} · {dateTime(h.closed_at ?? h.registered_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        )
      })}
    </ul>
  )
}
