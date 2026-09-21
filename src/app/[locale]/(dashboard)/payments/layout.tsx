import { getTranslations } from 'next-intl/server'

import { PaymentsNav } from '@/components/payments/PaymentsNav'

export default async function PaymentsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations('payments')

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-[#ededed]">{t('title')}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-[#888]">{t('subtitle')}</p>
      </header>
      <PaymentsNav basePath={`/${locale}/payments`} />
      {children}
    </div>
  )
}
