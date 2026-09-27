import type { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'
import { absoluteUrl, localeAlternates } from '@/lib/site'

/** Public pages only — one entry per locale, cross-linked with hreflang. */
const PAGES = [
  { path: '', priority: 1, changeFrequency: 'weekly' as const },
  { path: '/demo/payments', priority: 0.8, changeFrequency: 'monthly' as const },
  { path: '/register', priority: 0.7, changeFrequency: 'monthly' as const },
  { path: '/login', priority: 0.3, changeFrequency: 'yearly' as const },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' as const },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' as const },
  { path: '/imprint', priority: 0.3, changeFrequency: 'yearly' as const },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return PAGES.flatMap(({ path, priority, changeFrequency }) =>
    routing.locales.map((locale) => ({
      url: absoluteUrl(`/${locale}${path}`),
      lastModified,
      changeFrequency,
      priority,
      alternates: { languages: localeAlternates(path) },
    }))
  )
}
