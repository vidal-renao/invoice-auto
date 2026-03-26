import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav')
  return { title: t('settings') }
}

export default async function SettingsPage() {
  const t = await getTranslations('settings')

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
            <circle cx="8" cy="8" r="2" />
            <path
              d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-[#ededed]">{t('comingSoon')}</p>
      </div>
    </div>
  )
}
