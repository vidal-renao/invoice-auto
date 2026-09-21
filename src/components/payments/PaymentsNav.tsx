'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

const TABS = ['queue', 'suppliers', 'batches', 'audit', 'settings'] as const

export function PaymentsNav({ basePath }: { basePath: string }) {
  const t = useTranslations('payments.tabs')
  const tPayments = useTranslations('payments')
  const pathname = usePathname()

  return (
    <nav aria-label={tPayments('title')} className="-mx-1 overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b border-[#2a2a2a] px-1">
        {TABS.map((tab) => {
          const href = tab === 'queue' ? basePath : `${basePath}/${tab}`
          const active = tab === 'queue' ? pathname === basePath : pathname.startsWith(href)
          return (
            <li key={tab}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-block border-b-2 px-3 py-2 text-sm transition-colors',
                  active
                    ? 'border-violet-500 font-medium text-[#ededed]'
                    : 'border-transparent text-[#888] hover:text-[#ededed]',
                )}
              >
                {t(tab)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
