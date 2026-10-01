import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations('common')

  return (
    <div className="relative flex min-h-screen flex-col bg-canvas">

      {/* Subtle radial glow — connects visually to landing */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[120px]" />
      </div>

      {/* ── Top bar ──────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between border-b border-line bg-canvas/80 px-6 py-4 backdrop-blur-sm">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-600">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 4h10M3 8h7M3 12h4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-ink">Invoice Auto</span>
        </div>

        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <Link
            href={`/${locale}`}
            className="flex min-h-11 items-center gap-1.5 rounded-md border border-line px-3 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M7.5 2L3.5 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('backHome')}
          </Link>
        </div>
      </header>

      {/* ── Form area ────────────────────────────────────────── */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Card */}
          <div className="rounded-xl border border-line bg-surface/80 p-8 shadow-2xl shadow-black/60 backdrop-blur-sm">
            {children}
          </div>

          {/* Footer hint */}
          <p className="mt-6 text-center text-xs text-muted">
            © {new Date().getFullYear()} Vidal Ecosystem · Invoice Auto
          </p>
        </div>
      </main>
    </div>
  )
}
