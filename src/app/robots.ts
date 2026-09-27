import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

/**
 * The site had no robots.txt at all (404), so crawlers had no guidance and no
 * pointer to the sitemap. Everything behind the login is disallowed: those
 * routes redirect to /login anyway and crawling them only wastes budget.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/*/dashboard',
          '/*/invoices',
          '/*/payments',
          '/*/clients',
          '/*/settings',
          '/*/reset-password',
          '/*/forgot-password',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
