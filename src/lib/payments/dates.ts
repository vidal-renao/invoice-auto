/**
 * Calendar arithmetic on YYYY-MM-DD strings, in UTC so a server in another
 * time zone never shifts a date by one.
 *
 * Bank holidays are not modelled: they differ per canton and autonomous
 * community. The bank moves a transfer requested for a holiday to the
 * next business day, which is the documented, harmless failure mode.
 */

function toDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`)
}

function toDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(day: string, days: number): string {
  const d = toDate(day)
  d.setUTCDate(d.getUTCDate() + days)
  return toDay(d)
}

export function isWeekend(day: string): boolean {
  const weekday = toDate(day).getUTCDay()
  return weekday === 0 || weekday === 6
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function diffDays(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000)
}

/**
 * The date to ask the bank to execute on.
 *
 * Paying on the due date keeps the cash for as long as the terms allow. A
 * due date on a weekend moves to the Friday before, never after: late is
 * the failure that costs money. It is never earlier than today, because a
 * bank rejects execution dates in the past.
 */
export function requestedExecutionDate(dueDate: string | null, today: string): string {
  if (dueDate && dueDate > today) {
    let day = dueDate
    while (isWeekend(day) && day > today) day = addDays(day, -1)
    if (!isWeekend(day)) return day
  }
  let day = today
  while (isWeekend(day)) day = addDays(day, 1)
  return day
}

/**
 * "Today" for payment purposes. Spain (peninsula) and Switzerland share the
 * Central European time zone, so one business calendar serves both.
 */
export const BUSINESS_TIME_ZONE = 'Europe/Zurich'

export function businessToday(now: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE }).format(now)
}
