'use client'

import { useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

type Theme = 'light' | 'dark'

/** Kept in sync with the inline script in the root layout. */
const STORAGE_KEY = 'invoice-auto-theme'
const CHANGED = 'invoice-auto-theme-change'

/**
 * The active theme lives in the DOM (`<html data-theme>`) and in the system
 * preference, not in React state — the inline script sets it before the first
 * paint. Reading it through an external store keeps React in sync with both
 * without a render-after-mount.
 */
function subscribe(onChange: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: light)')
  media.addEventListener('change', onChange)
  window.addEventListener(CHANGED, onChange)
  return () => {
    media.removeEventListener('change', onChange)
    window.removeEventListener(CHANGED, onChange)
  }
}

function getSnapshot(): Theme {
  const chosen = document.documentElement.dataset.theme
  if (chosen === 'light' || chosen === 'dark') return chosen
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/** The server cannot know the visitor's preference; dark is the product default. */
function getServerSnapshot(): Theme {
  return 'dark'
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" strokeLinecap="round" />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Light/dark switch. Starts from the system preference and only stores a choice
 * once the visitor makes one, so a device set to light is respected without
 * being asked.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('common')
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode or blocked storage: the choice lasts for this page only.
    }
    window.dispatchEvent(new Event(CHANGED))
  }

  const goingToDark = theme === 'light'
  const label = goingToDark ? t('themeToDark') : t('themeToLight')

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-md text-muted transition-colors',
        'hover:bg-surface hover:text-ink',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className
      )}
    >
      {goingToDark ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
    </button>
  )
}
