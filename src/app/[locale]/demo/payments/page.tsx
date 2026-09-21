import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { QueueView } from '@/components/payments/QueueView'
import { SupplierAccounts } from '@/components/payments/SupplierAccounts'
import { businessToday } from '@/lib/payments/dates'
import { buildDemoWorkspace } from '@/lib/payments/demo'
import { buildQueue } from '@/lib/payments/queue'

/** Recomputed on every visit so the dates in the demo are always "now". */
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('payments.demo')
  return { title: t('title'), description: t('intro') }
}

export default async function PaymentsDemoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('payments')

  const now = new Date()
  const today = businessToday(now)
  const workspace = buildDemoWorkspace(now, today)
  const queue = buildQueue(workspace, now, today)

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed]">
      <header className="border-b border-[#2a2a2a]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <Link href={`/${locale}`} className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-600 text-xs font-bold text-white" aria-hidden="true">
              IA
            </span>
            Invoice Auto
          </Link>
          <Link
            href={`/${locale}/register`}
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            {t('demo.cta')}
          </Link>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-6xl space-y-10 px-4 py-8 md:px-6 md:py-10">
        <section className="space-y-4">
          <span className="inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-300">
            {t('demo.badge')}
          </span>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t('demo.title')}</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[#999] md:text-base">{t('subtitle')}</p>
          <p className="max-w-3xl text-sm leading-relaxed text-[#888]">{t('demo.intro')}</p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {/* A file download, not a page: client-side navigation would not save it. */}
            <a
              href="/api/demo/pain001"
              download
              className="rounded-md border border-[#2a2a2a] px-4 py-2 text-sm text-[#ededed] transition-colors hover:bg-[#1a1a1a]"
            >
              {t('demo.downloadSample')}
            </a>
            <p className="text-xs text-[#888]">{t('demo.readOnly')}</p>
          </div>
        </section>

        <QueueView queue={queue} readOnly settingsMissing={false} basePath={`/${locale}/demo/payments`} invoiceBase={null} />

        <section aria-labelledby="demo-suppliers" className="space-y-4">
          <h2 id="demo-suppliers" className="text-base font-semibold">{t('suppliers.title')}</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-[#888]">{t('suppliers.intro')}</p>
          <SupplierAccounts
            readOnly
            now={now.toISOString()}
            accounts={workspace.accounts.map((a) => ({
              ...a,
              // The new supplier's IBAN was taken from its invoice; the rest were on file.
              source: a.status === 'pending_verification' ? 'invoice' : 'manual',
              verification_contact: a.verified_at ? '•••• ••• 212' : null,
              rejection_reason: null,
              // A superseded account closed when its replacement was registered.
              closed_at:
                a.status === 'superseded'
                  ? (workspace.accounts.find((b) => b.supplier_key === a.supplier_key && b.registered_at > a.registered_at)
                      ?.registered_at ?? null)
                  : null,
            }))}
          />
        </section>
      </main>
    </div>
  )
}
