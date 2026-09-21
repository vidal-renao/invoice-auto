'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useId, useState, useTransition } from 'react'

import { Button } from '@/components/ui/Button'
import { acceptPaymentReview, registerSupplierAccount, type PaymentErrorCode } from '@/lib/actions/payments'

type CommandResult = { ok: true } | { ok: false; error: PaymentErrorCode; detail?: string }

const inputClass =
  'w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-sm text-[#ededed] placeholder:text-[#808080] focus:border-violet-500 focus:outline-none'

function useCommand() {
  const t = useTranslations('payments')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const run = (command: () => Promise<CommandResult>, onDone?: () => void) => {
    setError(null)
    startTransition(async () => {
      const result = await command()
      if (!result.ok) {
        // Field-level messages (e.g. IBAN checksum) are more precise than the generic code.
        setError(t(`errors.${result.detail && result.error === 'invalid' ? result.detail : result.error}`))
        return
      }
      onDone?.()
      router.refresh()
    })
  }
  return { pending, error, run }
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p role="alert" className="text-xs text-red-300">
      {error}
    </p>
  )
}

/** Accepting a review needs a written reason; it is stored in the audit log. */
export function AcceptReviewForm({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations('payments.queue')
  const id = useId()
  const [note, setNote] = useState('')
  const { pending, error, run } = useCommand()

  return (
    <form
      className="mt-3 space-y-2 border-t border-[#1e1e1e] pt-3"
      onSubmit={(event) => {
        event.preventDefault()
        run(() => acceptPaymentReview({ invoice_id: invoiceId, note }))
      }}
    >
      <label htmlFor={id} className="block text-xs font-medium text-[#aaa]">
        {t('acceptNote')}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('acceptPlaceholder')}
          minLength={3}
          maxLength={500}
          required
          className={inputClass}
        />
        <Button type="submit" size="sm" variant="ghost" loading={pending} disabled={pending || note.trim().length < 3} className="h-auto shrink-0 py-2">
          {t('accept')}
        </Button>
      </div>
      <ErrorLine error={error} />
    </form>
  )
}

/**
 * Registers the supplier's account from the invoice. The IBAN printed on
 * the invoice is proposed, never trusted: it starts unverified either way.
 */
export function RegisterAccountForm({ invoiceId, printedIban }: { invoiceId: string; printedIban: string | null }) {
  const t = useTranslations('payments.queue')
  const id = useId()
  const [manual, setManual] = useState(printedIban === null)
  const [iban, setIban] = useState('')
  const { pending, error, run } = useCommand()

  return (
    <form
      className="mt-3 space-y-2 border-t border-[#1e1e1e] pt-3"
      onSubmit={(event) => {
        event.preventDefault()
        run(() => registerSupplierAccount(manual ? { invoice_id: invoiceId, iban } : { invoice_id: invoiceId }))
      }}
    >
      {manual ? (
        <>
          <label htmlFor={id} className="block text-xs font-medium text-[#aaa]">
            IBAN
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={id}
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="ES91 2100 0418 4502 0005 1332"
              required
              className={`${inputClass} font-mono`}
            />
            <Button type="submit" size="sm" variant="ghost" loading={pending} disabled={pending || iban.trim().length < 15} className="h-auto shrink-0 py-2">
              {t('register')}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" variant="ghost" loading={pending} disabled={pending}>
            {t('registerIban')}
          </Button>
          <button type="button" onClick={() => setManual(true)} className="text-xs text-[#888] underline hover:text-[#ededed]">
            {t('enterOtherIban')}
          </button>
        </div>
      )}
      <ErrorLine error={error} />
    </form>
  )
}
