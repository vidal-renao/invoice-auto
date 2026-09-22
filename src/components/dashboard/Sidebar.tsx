'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { BrandMark, LogOutIcon, useDashboardNav } from './nav-items'

interface SidebarProps {
  locale: string
}

export function Sidebar({ locale }: SidebarProps) {
  const t = useTranslations('nav')
  const { items, logoutLabel, logout } = useDashboardNav(locale)

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-[#2a2a2a] bg-[#0a0a0a]">
      {/* Brand */}
      <div className="flex h-14 items-center border-b border-[#2a2a2a] px-4">
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
                ? 'bg-[#1a1a1a] text-[#ededed]'
                : 'text-[#888] hover:bg-[#111] hover:text-[#ededed]'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-[#2a2a2a] px-2 py-4">
        <button
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[#888] transition-colors duration-150 hover:bg-[#111] hover:text-[#ededed]"
        >
          <LogOutIcon className="h-4 w-4 shrink-0" />
          {logoutLabel}
        </button>
      </div>
    </aside>
  )
}
