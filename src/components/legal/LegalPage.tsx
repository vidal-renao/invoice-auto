import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import type { LegalDocument } from '@/content/legal'

interface LegalPageProps {
  doc: LegalDocument
  locale: string
}

/** Shared shell for the privacy, terms and imprint pages. */
export async function LegalPage({ doc, locale }: LegalPageProps) {
  const t = await getTranslations({ locale, namespace: 'landing.footer' })
  const tc = await getTranslations({ locale, namespace: 'common' })

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href={`/${locale}`}
            className="flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-600 text-xs font-bold text-white"
              aria-hidden="true"
            >
              IA
            </span>
            Invoice Auto
          </Link>
          <Link
            href={`/${locale}`}
            className="flex min-h-11 items-center rounded-md px-2 text-sm text-muted underline underline-offset-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
          >
            {tc('backHome')}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">{doc.title}</h1>
        <p className="mb-8 text-xs text-muted">
          <time dateTime={doc.updated}>{doc.updated}</time>
        </p>
        <p className="mb-10 text-base leading-relaxed text-muted">{doc.intro}</p>

        <div className="space-y-10">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="mb-3 text-lg font-semibold tracking-tight">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mb-3 text-sm leading-relaxed text-muted">
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-3 space-y-2">
                  {section.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="border-l-2 border-line pl-4 text-sm leading-relaxed text-muted"
                    >
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-line px-6 py-10">
        <nav
          aria-label={t('legal')}
          className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted"
        >
          {[
            { href: `/${locale}/privacy`, label: t('privacy') },
            { href: `/${locale}/terms`, label: t('terms') },
            { href: `/${locale}/imprint`, label: t('imprint') },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-11 items-center rounded-md px-2 underline underline-offset-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  )
}
