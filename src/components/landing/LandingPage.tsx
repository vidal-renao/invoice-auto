'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export default function LandingPage() {
  const t = useTranslations('landing')
  const locale = useLocale()

  const stats = [
    { value: t('hero.stat1Value'), label: t('hero.stat1Label') },
    { value: t('hero.stat2Value'), label: t('hero.stat2Label') },
    { value: t('hero.stat3Value'), label: t('hero.stat3Label') },
  ]

  const steps = [
    { num: '01', icon: '📤', title: t('how.step1Title'), desc: t('how.step1Desc') },
    { num: '02', icon: '🤖', title: t('how.step2Title'), desc: t('how.step2Desc') },
    { num: '03', icon: '✅', title: t('how.step3Title'), desc: t('how.step3Desc') },
  ]

  const features = [
    { icon: '👁', color: 'text-accent-text', title: t('features.feat1Title'), desc: t('features.feat1Desc') },
    { icon: '🌍', color: 'text-success-text', title: t('features.feat2Title'), desc: t('features.feat2Desc') },
    { icon: '💱', color: 'text-accent-text', title: t('features.feat3Title'), desc: t('features.feat3Desc') },
    { icon: '📱', color: 'text-warning-text', title: t('features.feat4Title'), desc: t('features.feat4Desc') },
  ]

  return (
    <div className="min-h-screen bg-canvas text-ink">

      {/* ── Navbar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-line bg-canvas/90 backdrop-blur-sm">
        <nav
          className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
          aria-label="Main navigation"
        >
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-600 text-xs font-bold text-white"
              aria-hidden="true"
            >
              IA
            </span>
            <span className="hidden text-sm font-semibold tracking-tight sm:inline">Invoice Auto</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/demo/payments`}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:px-4"
            >
              {t('nav.demo')}
            </Link>
            <Link
              href={`/${locale}/login`}
              className="hidden rounded-md px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:inline-block"
            >
              {t('nav.signin')}
            </Link>
            <Link
              href={`/${locale}/register`}
              className="whitespace-nowrap rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t('nav.getStarted')}
            </Link>
            <LocaleSwitcher className="hidden md:flex" />
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <main>
        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-24 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-medium text-accent-text">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" aria-hidden="true" />
            {t('hero.badge')}
          </div>
          <h1 className="mx-auto mb-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {t('hero.headline')}
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-base text-muted sm:text-lg">
            {t('hero.subline')}
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={`/${locale}/register`}
              className="rounded-md bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t('hero.cta')}
            </Link>
            <Link
              href={`/${locale}/login`}
              className="rounded-md border border-line px-6 py-3 text-sm font-semibold text-muted transition-colors hover:border-faint hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t('hero.signin')}
            </Link>
          </div>

          {/* Stats strip */}
          <div className="mt-16 grid grid-cols-1 divide-y divide-line overflow-hidden rounded-xl border border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-surface px-8 py-8">
                <div className="text-3xl font-bold">{stat.value}</div>
                <div className="mt-1 text-sm text-muted">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── El producto, en capturas reales ────────────────── */}
        <section className="border-t border-line bg-canvas-alt py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-12 max-w-2xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-accent-text">
                {t('showcase.label')}
              </p>
              <h2 className="mb-4 text-3xl font-bold tracking-tight">{t('showcase.title')}</h2>
              <p className="text-base leading-relaxed text-muted">{t('showcase.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <figure className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-line bg-surface">
                  <Image
                    src="/capturas/emitir-light.png"
                    alt={t('showcase.issueAlt')}
                    width={2000}
                    height={856}
                    sizes="(min-width: 1024px) 45vw, 92vw"
                    className="w-full dark:hidden"
                  />
                  <Image
                    src="/capturas/emitir-dark.png"
                    alt={t('showcase.issueAlt')}
                    width={2000}
                    height={856}
                    sizes="(min-width: 1024px) 45vw, 92vw"
                    className="hidden w-full dark:block"
                  />
                </div>
                <figcaption className="text-sm leading-relaxed text-muted">
                  {t('showcase.issueCaption')}
                </figcaption>
              </figure>

              <figure className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-line bg-surface">
                  <Image
                    src="/capturas/pagos-light.png"
                    alt={t('showcase.payAlt')}
                    width={2200}
                    height={1520}
                    sizes="(min-width: 1024px) 45vw, 92vw"
                    className="w-full dark:hidden"
                  />
                  <Image
                    src="/capturas/pagos-dark.png"
                    alt={t('showcase.payAlt')}
                    width={2200}
                    height={1520}
                    sizes="(min-width: 1024px) 45vw, 92vw"
                    className="hidden w-full dark:block"
                  />
                </div>
                <figcaption className="text-sm leading-relaxed text-muted">
                  {t('showcase.payCaption')}
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* ── How it Works ───────────────────────────────────── */}
        <section className="border-t border-line bg-canvas-alt py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-12 text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-accent-text">
                {t('how.label')}
              </p>
              <h2 className="text-3xl font-bold tracking-tight">{t('how.title')}</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {steps.map((step, i) => (
                <div key={step.num} className="relative rounded-xl border border-line bg-surface p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="text-2xl" role="img" aria-label={step.title}>{step.icon}</span>
                    <span className="font-mono text-xs text-muted">{step.num}</span>
                  </div>
                  <h3 className="mb-2 text-base font-semibold">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{step.desc}</p>
                  {i < steps.length - 1 && (
                    <div className="absolute -right-4 top-1/2 hidden -translate-y-1/2 text-faint md:block" aria-hidden="true">
                      →
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────── */}
        <section className="border-t border-line py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-12 text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-accent-text">
                {t('features.label')}
              </p>
              <h2 className="text-3xl font-bold tracking-tight">{t('features.title')}</h2>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feat) => (
                <div key={feat.title} className="rounded-xl border border-line bg-surface p-5">
                  <div className={`mb-3 text-2xl ${feat.color}`} role="img" aria-label={feat.title}>
                    {feat.icon}
                  </div>
                  <h3 className="mb-2 text-sm font-semibold">{feat.title}</h3>
                  <p className="text-xs leading-relaxed text-muted">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Payments engine — the Swiss/SEPA differentiator ── */}
        <section className="border-t border-line bg-canvas-alt py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-12 max-w-2xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-accent-text">
                {t('payments.label')}
              </p>
              <h2 className="mb-4 text-3xl font-bold tracking-tight">{t('payments.title')}</h2>
              <p className="text-base leading-relaxed text-muted">{t('payments.desc')}</p>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {[
                { title: t('payments.b1'), desc: t('payments.b1d') },
                { title: t('payments.b2'), desc: t('payments.b2d') },
                { title: t('payments.b3'), desc: t('payments.b3d') },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-line bg-surface p-5">
                  <h3 className="mb-2 text-sm font-semibold">{item.title}</h3>
                  <p className="text-xs leading-relaxed text-muted">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Link
                href={`/${locale}/demo/payments`}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-violet-500/40 bg-violet-500/10 px-5 text-sm font-semibold text-accent-text transition-colors hover:border-violet-400 hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {t('payments.cta')} →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Acceso por QR ──────────────────────────────────── */}
        <section className="border-t border-line py-20">
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 sm:grid-cols-[auto_1fr]">
            <div className="mx-auto rounded-xl border border-line bg-white p-4 sm:mx-0">
              <Image
                src="/qr/invoice-auto.svg"
                alt={t('qr.alt')}
                width={200}
                height={200}
                className="h-44 w-44"
                unoptimized
              />
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-accent-text">
                {t('qr.label')}
              </p>
              <h2 className="mb-3 text-2xl font-bold tracking-tight">{t('qr.title')}</h2>
              <p className="mb-5 max-w-lg text-base leading-relaxed text-muted">{t('qr.description')}</p>
              <a
                href="/qr/invoice-auto.png"
                download
                className="inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {t('qr.download')}
              </a>
            </div>
          </div>
        </section>

        {/* ── Final CTA ──────────────────────────────────────── */}
        <section className="border-t border-line bg-canvas-alt py-24">
          <div className="mx-auto max-w-2xl px-6 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight">{t('cta.title')}</h2>
            <p className="mb-8 text-base text-muted">{t('cta.subtitle')}</p>
            <Link
              href={`/${locale}/register`}
              className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t('cta.button')}
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-line px-6 py-10 text-xs text-muted">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 md:flex-row md:items-center md:justify-between">
          <nav aria-label={t('footer.legal')} className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            {[
              { href: `/${locale}/privacy`, label: t('footer.privacy') },
              { href: `/${locale}/terms`, label: t('footer.terms') },
              { href: `/${locale}/imprint`, label: t('footer.imprint') },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-11 items-center rounded-md px-2 underline underline-offset-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {item.label}
              </Link>
            ))}
            <a
              href="mailto:vidalrenao.lab@outlook.com"
              className="flex min-h-11 items-center rounded-md px-2 underline underline-offset-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              vidalrenao.lab@outlook.com
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle className="md:hidden" />
            <p>© {new Date().getFullYear()} Vidal Ecosystem</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
