'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

// ── Inline SVG icons (no icon library dependency) ──────────────────────────

interface IconProps {
  className?: string
}

function GridIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
    </svg>
  )
}

function FileIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M9 1.5H3.5A1 1 0 0 0 2.5 2.5v11a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V6l-4.5-4.5Z" strokeLinejoin="round" />
      <path d="M9 1.5V6h4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PaymentIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
      <path d="M1.5 6.5h13" />
      <path d="M4 10h3" strokeLinecap="round" />
    </svg>
  )
}

function UsersIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 13c0-2.21 2.239-4 5-4s5 1.79 5 4" strokeLinecap="round" />
      <path d="M11 7c1.38 0 2.5 1.12 2.5 2.5S12.38 12 11 12" strokeLinecap="round" />
      <path d="M13.5 13c0-1.1-.7-2.06-1.75-2.6" strokeLinecap="round" />
    </svg>
  )
}

function SettingsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41" strokeLinecap="round" />
    </svg>
  )
}

export function LogOutIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M6 2H2.5A1 1 0 0 0 1.5 3v10a1 1 0 0 0 1 1H6" strokeLinecap="round" />
      <path d="M11 5l3 3-3 3M14 8H6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-6 w-6 items-center justify-center rounded bg-violet-700">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 4h10M3 8h7M3 12h4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <span className="text-sm font-semibold text-[#ededed]">Invoice Auto</span>
    </div>
  )
}

// ── Shared navigation model (Sidebar + MobileNav) ───────────────────────────

export interface NavItem {
  href: string
  label: string
  Icon: (props: IconProps) => React.JSX.Element
  isActive: boolean
}

interface DashboardNav {
  items: NavItem[]
  logoutLabel: string
  logout: () => Promise<void>
}

export function useDashboardNav(locale: string): DashboardNav {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const router = useRouter()

  const items = [
    { href: `/${locale}/dashboard`, label: t('dashboard'), Icon: GridIcon },
    { href: `/${locale}/invoices`, label: t('invoices'), Icon: FileIcon },
    { href: `/${locale}/payments`, label: t('payments'), Icon: PaymentIcon },
    { href: `/${locale}/clients`, label: t('clients'), Icon: UsersIcon },
    { href: `/${locale}/settings`, label: t('settings'), Icon: SettingsIcon },
  ].map((item) => ({
    ...item,
    isActive: pathname === item.href || pathname.startsWith(`${item.href}/`),
  }))

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(`/${locale}/login`)
    router.refresh()
  }

  return { items, logoutLabel: t('logout'), logout }
}
