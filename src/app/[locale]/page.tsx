import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LandingPage from '@/components/landing/LandingPage'
import { absoluteUrl, localeAlternates, SITE_URL } from '@/lib/site'

interface HomeProps {
  params: Promise<{ locale: string }>
}

/**
 * Every locale used to serve the same title ("Invoice Auto") and description,
 * with no canonical, no hreflang and no social card: the three translations
 * competed with each other and a shared link showed nothing.
 */
export async function generateMetadata({ params }: HomeProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'landing.seo' })
  const url = absoluteUrl(`/${locale}`)

  return {
    title: { absolute: `${t('title')} · Invoice Auto` },
    description: t('description'),
    alternates: { canonical: url, languages: localeAlternates('') },
    openGraph: {
      type: 'website',
      siteName: 'Invoice Auto',
      locale,
      url,
      title: t('title'),
      description: t('description'),
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
  }
}

/**
 * Root page — shows landing for unauthenticated users,
 * redirects to dashboard if already signed in.
 */
export default async function HomePage({ params }: HomeProps) {
  const { locale } = await params

  // Almost every visitor here is anonymous, and asking Supabase to validate a
  // session they do not have costs a network round trip per page view. No auth
  // cookie means no session to check.
  const cookieStore = await cookies()
  const hasSession = cookieStore
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'))

  if (hasSession) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      redirect(`/${locale}/dashboard`)
    }
  }

  const t = await getTranslations({ locale, namespace: 'landing.seo' })

  // Structured data: lets search engines show this as software rather than as
  // an untyped page. Kept minimal — only claims that are true and checkable.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'Invoice Auto',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web, iOS, Android',
        description: t('description'),
        url: absoluteUrl(`/${locale}`),
        inLanguage: locale,
        featureList: [
          'AI extraction of supplier, amounts and VAT from receipts and invoices',
          'Tax engine covering 16 jurisdictions with reverse charge detection',
          'SEPA and Swiss QR payment decisions with ISO 20022 pain.001 export',
        ],
      },
      {
        '@type': 'Organization',
        name: 'Invoice Auto',
        url: SITE_URL,
        email: 'vidalrenao.lab@outlook.com',
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        // Serialised server-side from a literal we control; no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  )
}
