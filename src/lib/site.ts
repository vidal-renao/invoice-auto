import { routing } from '@/i18n/routing'

/**
 * Canonical origin of the public site.
 *
 * Vercel exposes the deployment host, but a preview deployment must not emit
 * canonicals pointing at itself: search engines would index the preview. So the
 * production domain wins unless NEXT_PUBLIC_SITE_URL says otherwise.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://invoice-auto-xi.vercel.app'
).replace(/\/$/, '')

/** Public routes worth declaring to search engines, without the locale prefix. */
export const PUBLIC_PATHS = ['', '/demo/payments', '/login', '/register', '/privacy', '/terms', '/imprint'] as const

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * `hreflang` map for one page across every locale, plus `x-default`.
 * Without it the three translations of a page compete with each other.
 */
export function localeAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {}
  for (const locale of routing.locales) {
    languages[locale] = absoluteUrl(`/${locale}${path}`)
  }
  languages['x-default'] = absoluteUrl(`/${routing.defaultLocale}${path}`)
  return languages
}
