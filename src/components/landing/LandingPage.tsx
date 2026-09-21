'use client'

import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'

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
    { icon: '👁', color: 'text-violet-400', title: t('features.feat1Title'), desc: t('features.feat1Desc') },
    { icon: '🌍', color: 'text-emerald-400', title: t('features.feat2Title'), desc: t('features.feat2Desc') },
    { icon: '💱', color: 'text-blue-400', title: t('features.feat3Title'), desc: t('features.feat3Desc') },
    { icon: '📱', color: 'text-amber-400', title: t('features.feat4Title'), desc: t('features.feat4Desc') },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed]">

      {/* ── Navbar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-[#2a2a2a] bg-[#0a0a0a]/90 backdrop-blur-sm">
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
            <span className="text-sm font-semibold tracking-tight">Invoice Auto</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/demo/payments`}
              className="hidden rounded-md px-4 py-2 text-sm font-medium text-[#888] transition-colors hover:text-[#ededed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:inline-block"
            >
              {t('nav.demo')}
            </Link>
            <Link
              href={`/${locale}/login`}
              className="rounded-md px-4 py-2 text-sm font-medium text-[#888] transition-colors hover:text-[#ededed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              {t('nav.signin')}
            </Link>
            <Link
              href={`/${locale}/register`}
              className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              {t('nav.getStarted')}
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-24 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-medium text-violet-400">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" aria-hidden="true" />
            {t('hero.badge')}
          </div>
          <h1 className="mx-auto mb-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {t('hero.headline')}
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-base text-[#888] sm:text-lg">
            {t('hero.subline')}
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={`/${locale}/register`}
              className="rounded-md bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              {t('hero.cta')}
            </Link>
            <Link
              href={`/${locale}/login`}
              className="rounded-md border border-[#2a2a2a] px-6 py-3 text-sm font-semibold text-[#888] transition-colors hover:border-[#444] hover:text-[#ededed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              {t('hero.signin')}
            </Link>
          </div>

          {/* Stats strip */}
          <div className="mt-16 grid grid-cols-1 divide-y divide-[#2a2a2a] overflow-hidden rounded-xl border border-[#2a2a2a] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-[#111] px-8 py-8">
                <div className="text-3xl font-bold">{stat.value}</div>
                <div className="mt-1 text-sm text-[#888]">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it Works ───────────────────────────────────── */}
        <section className="border-t border-[#2a2a2a] bg-[#0d0d0d] py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-12 text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-violet-400">
                {t('how.label')}
              </p>
              <h2 className="text-3xl font-bold tracking-tight">{t('how.title')}</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {steps.map((step, i) => (
                <div key={step.num} className="relative rounded-xl border border-[#2a2a2a] bg-[#111] p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="text-2xl" role="img" aria-label={step.title}>{step.icon}</span>
                    <span className="font-mono text-xs text-[#555]">{step.num}</span>
                  </div>
                  <h3 className="mb-2 text-base font-semibold">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-[#888]">{step.desc}</p>
                  {i < steps.length - 1 && (
                    <div className="absolute -right-4 top-1/2 hidden -translate-y-1/2 text-[#444] md:block" aria-hidden="true">
                      →
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────── */}
        <section className="border-t border-[#2a2a2a] py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-12 text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-violet-400">
                {t('features.label')}
              </p>
              <h2 className="text-3xl font-bold tracking-tight">{t('features.title')}</h2>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feat) => (
                <div key={feat.title} className="rounded-xl border border-[#2a2a2a] bg-[#111] p-5">
                  <div className={`mb-3 text-2xl ${feat.color}`} role="img" aria-label={feat.title}>
                    {feat.icon}
                  </div>
                  <h3 className="mb-2 text-sm font-semibold">{feat.title}</h3>
                  <p className="text-xs leading-relaxed text-[#888]">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ──────────────────────────────────────── */}
        <section className="border-t border-[#2a2a2a] bg-[#0d0d0d] py-24">
          <div className="mx-auto max-w-2xl px-6 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight">{t('cta.title')}</h2>
            <p className="mb-8 text-base text-[#888]">{t('cta.subtitle')}</p>
            <Link
              href={`/${locale}/register`}
              className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              {t('cta.button')}
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-[#2a2a2a] px-6 py-8 text-center text-xs text-[#555]">
        <p>
          © {new Date().getFullYear()} Invoice Auto ·{' '}
          <a
            href="mailto:vidalrenao.lab@outlook.com"
            className="transition-colors hover:text-[#888]"
          >
            vidalrenao.lab@outlook.com
          </a>
        </p>
      </footer>
    </div>
  )
}
