import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav')
  return { title: t('clients') }
}

export default async function ClientsPage() {
  const t = await getTranslations('clients')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[#ededed]">{t('title')}</h1>

      <div className="flex flex-col items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#111] py-20 text-center">
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="#555"
            strokeWidth="1.4"
            className="h-7 w-7"
          >
            <circle cx="6" cy="5" r="2.5" />
            <path d="M1 13c0-2.21 2.239-4 5-4s5 1.79 5 4" strokeLinecap="round" />
            <path d="M11 7c1.38 0 2.5 1.12 2.5 2.5S12.38 12 11 12" strokeLinecap="round" />
            <path d="M13.5 13c0-1.1-.7-2.06-1.75-2.6" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[#ededed]">{t('comingSoon')}</p>
      </div>
    </div>
  )
}
