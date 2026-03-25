import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['es', 'de', 'en'],
  defaultLocale: 'es',
  localePrefix: 'always',
})

export type AppLocale = (typeof routing.locales)[number]
