'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { routing } from '@/i18n/routing'
import { cn } from '@/lib/utils'

const LABELS: Record<string, string> = { es: 'ES', de: 'DE', en: 'EN' }

/**
 * The app speaks three languages and had no way to switch between them — not on
 * the landing, not behind the login. Plain links, so they work without
 * JavaScript and search engines see the translations.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const active = useLocale()
  const pathname = usePathname()
  const t = useTranslations('landing.footer')

  // "/es/demo/payments" → "/demo/payments"; the switcher keeps you on the page.
  const rest = pathname.replace(new RegExp(`^/(${routing.locales.join('|')})`), '')

  return (
    <nav aria-label={t('language')} className={cn('flex items-center gap-1', className)}>
      {routing.locales.map((locale) => {
        const isActive = locale === active
        return (
          <Link
            key={locale}
            href={`/${locale}${rest}`}
            hrefLang={locale}
            lang={locale}
            aria-current={isActive ? 'true' : undefined}
            className={cn(
              'flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              isActive
                ? 'bg-elevated text-ink'
                : 'text-muted hover:bg-surface hover:text-ink'
            )}
          >
            {LABELS[locale] ?? locale.toUpperCase()}
          </Link>
        )
      })}
    </nav>
  )
}
