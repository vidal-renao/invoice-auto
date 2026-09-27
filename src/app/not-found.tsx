import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'

/**
 * Global 404. A path that matches no route never reaches the [locale] segment,
 * so this is the file that actually answers a mistyped or dead link — and it
 * was Next's unstyled English default on a site that speaks three languages.
 * The locale still resolves here because the middleware negotiated it.
 */
export default async function NotFound() {
  const locale = await getLocale().catch(() => 'es')
  const t = await getTranslations({ locale, namespace: 'notFound' })

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
      <p className="mb-3 font-mono text-sm text-muted">404</p>
      <h1 className="mb-3 text-2xl font-bold tracking-tight text-ink">{t('title')}</h1>
      <p className="mb-8 max-w-sm text-sm leading-relaxed text-muted">{t('desc')}</p>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Link
          href={`/${locale}`}
          className="flex min-h-11 items-center rounded-md bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t('cta')}
        </Link>
        <Link
          href={`/${locale}/demo/payments`}
          className="flex min-h-11 items-center rounded-md border border-line px-5 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t('demo')}
        </Link>
      </div>
    </div>
  )
}
