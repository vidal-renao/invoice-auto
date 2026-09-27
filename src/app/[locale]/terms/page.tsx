import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/LegalPage'
import { getLegal } from '@/content/legal'
import { absoluteUrl, localeAlternates } from '@/lib/site'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const doc = getLegal(locale).terms

  return {
    title: doc.title,
    description: doc.intro,
    alternates: {
      canonical: absoluteUrl(`/${locale}/terms`),
      languages: localeAlternates('/terms'),
    },
  }
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params
  return <LegalPage doc={getLegal(locale).terms} locale={locale} />
}
