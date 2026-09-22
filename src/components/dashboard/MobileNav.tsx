'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { BrandMark, LogOutIcon, useDashboardNav } from './nav-items'

interface MobileNavProps {
  locale: string
}

const DRAWER_ID = 'mobile-nav-drawer'
const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500'

/**
 * Top bar + slide-in drawer for < md viewports.
 *
 * The drawer is a native modal <dialog>: showModal() makes the rest of the
 * document inert (focus trap), Escape closes it via the `cancel` event, and
 * the browser restores focus to the menu button on close.
 */
export function MobileNav({ locale }: MobileNavProps) {
  const t = useTranslations('nav')
  const { items, logoutLabel, logout } = useDashboardNav(locale)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)

  const openDrawer = () => {
    dialogRef.current?.showModal()
    setOpen(true)
  }
  const closeDrawer = () => dialogRef.current?.close()

  // A modal dialog left open while the viewport grows to md+ would block the
  // desktop layout, so close it when the sidebar takes over.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 48rem)')
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) dialogRef.current?.close()
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#2a2a2a] bg-[#0a0a0a] px-4 md:hidden">
        <BrandMark />
        <button
          type="button"
          onClick={openDrawer}
          aria-label={t('openMenu')}
          aria-expanded={open}
          aria-controls={DRAWER_ID}
          className={cn(
            '-mr-2 flex h-11 w-11 items-center justify-center rounded-md text-[#ededed] hover:bg-[#1a1a1a]',
            FOCUS_RING
          )}
        >
          <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {/* Backdrop clicks land on the <dialog> itself; content clicks land on its children. */}
      <dialog
        ref={dialogRef}
        id={DRAWER_ID}
        aria-label={t('menu')}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeDrawer()
        }}
        className="m-0 h-dvh max-h-none w-72 max-w-[85vw] border-r border-[#2a2a2a] bg-[#0a0a0a] p-0 text-[#ededed] backdrop:bg-black/70 md:hidden"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#2a2a2a] px-4">
            <BrandMark />
            <button
              type="button"
              onClick={closeDrawer}
              aria-label={t('closeMenu')}
              className={cn(
                '-mr-2 flex h-11 w-11 items-center justify-center rounded-md text-[#ededed] hover:bg-[#1a1a1a]',
                FOCUS_RING
              )}
            >
              <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4" aria-label={t('mainNavigation')}>
            {items.map(({ href, label, Icon, isActive }) => (
              <Link
                key={href}
                href={href}
                onClick={closeDrawer}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-150',
                  FOCUS_RING,
                  isActive
                    ? 'bg-[#1a1a1a] text-[#ededed]'
                    : 'text-[#a3a3a3] hover:bg-[#111] hover:text-[#ededed]'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="shrink-0 border-t border-[#2a2a2a] px-2 py-4">
            <button
              type="button"
              onClick={() => {
                closeDrawer()
                void logout()
              }}
              className={cn(
                'flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm text-[#a3a3a3] transition-colors duration-150 hover:bg-[#111] hover:text-[#ededed]',
                FOCUS_RING
              )}
            >
              <LogOutIcon className="h-4 w-4 shrink-0" />
              {logoutLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
