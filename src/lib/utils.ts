import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes without conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a monetary amount stored as integer cents.
 * e.g. formatCurrency(12050, 'EUR', 'es') → "120,50 €"
 */
export function formatCurrency(
  cents: number,
  currency: string,
  locale: string
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

/**
 * Format a UTC ISO date string for display.
 * e.g. formatDate('2024-03-15T00:00:00Z', 'es') → "15 mar 2024"
 */
export function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(iso)
  )
}
