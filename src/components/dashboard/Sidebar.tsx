'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { BrandMark, LogOutIcon, useDashboardNav } from './nav-items'

interface SidebarProps {
  locale: string
}

export function Sidebar({ locale }: SidebarProps) {
  const t = useTranslations('nav')
  const { items, logoutLabel, logout } = useDashboardNav(locale)

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-line bg-canvas">
      {/* Brand */}
      <div className="flex h-14 items-center border-b border-line px-4">
        <BrandMark />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-2 py-4" aria-label={t('mainNavigation')}>
        {items.map(({ href, label, Icon, isActive }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-150',
              isActive
                ? 'bg-elevated text-ink'
                : 'text-muted hover:bg-surface hover:text-ink'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Language, theme and sign out */}
      <div className="border-t border-line px-2 py-4">
        <div className="mb-2 flex items-center justify-between gap-1 px-1">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted transition-colors duration-150 hover:bg-surface hover:text-ink"
        >
          <LogOutIcon className="h-4 w-4 shrink-0" />
          {logoutLabel}
        </button>
      </div>
    </aside>
  )
}
