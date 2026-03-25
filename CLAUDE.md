# CLAUDE.md — Invoice Auto · Autonomous Behavior Guide

This file governs how Claude Code operates within this repository.
All rules apply to every session unless the user explicitly overrides them.

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Framework   | Next.js 16 (App Router)             |
| Language    | TypeScript 5 — strict mode          |
| Styling     | Tailwind CSS v4                     |
| Backend/DB  | Supabase (Postgres + Auth + Storage)|
| Deployment  | Vercel                              |

---

## Quality Standard

**Target: 100/100 Lighthouse across all four categories.**

- Performance, Accessibility, Best Practices, SEO.
- Every new page or component must not regress any score.
- Use `next/image` for all images, `next/font` for typography.
- Prefer `React.lazy` / dynamic imports for heavy client-side modules.
- Never ship unused CSS — rely on Tailwind's JIT purging.
- Add `aria-*` attributes and semantic HTML from the first commit.

---

## Golden Rules

### 1. Never assume context — ask first
If a requirement is ambiguous, stop and ask a focused question before writing code.
One clarifying question beats one wrong implementation.

### 2. Strict TypeScript — always
- `tsconfig.json` must have `"strict": true` and `"noUncheckedIndexedAccess": true`.
- No `any`. Use `unknown` and narrow explicitly.
- All props, API responses, and Supabase row types must be typed.
- Generate DB types with `supabase gen types typescript`.

### 3. Dark mode first — Vercel/Linear aesthetic
- Design tokens and components start from dark backgrounds (`#0a0a0a`, `#111`, `#1a1a1a`).
- Light mode is a secondary concern; implement it only when explicitly requested.
- Use `tailwind`'s `dark:` variant for all color utilities.
- Maintain high contrast ratios (WCAG AA minimum, AAA preferred).
- Accent color: electric indigo / violet (`violet-500` / `#7c3aed`) or `neutral` grays.
- Typography: Inter or Geist via `next/font`; tight leading, generous spacing.

### 4. Internationalisation (i18n) from component zero
- **Supported locales: `es` (default), `de`, `en`.**
- Use `next-intl` as the i18n library.
- Every user-facing string must live in `/messages/{locale}.json`.
- No hardcoded strings anywhere in JSX/TSX.
- File structure:
  ```
  /messages
    es.json   ← default
    de.json
    en.json
  ```
- Locale is resolved via Next.js middleware (`/src/middleware.ts`).
- Date, number, and currency formatting must use `Intl.*` APIs with the active locale.

---

## Project Structure (canonical)

```
/
├── src/
│   ├── app/                  # Next.js App Router pages & layouts
│   │   └── [locale]/         # Localised route group
│   ├── components/           # Reusable UI components
│   │   └── ui/               # Primitives (Button, Input, Card…)
│   ├── lib/                  # Utilities, Supabase client, helpers
│   │   └── supabase/
│   │       ├── client.ts     # Browser client
│   │       └── server.ts     # Server-side client (cookies)
│   ├── types/                # Shared TypeScript types & DB types
│   ├── hooks/                # Custom React hooks
│   └── middleware.ts         # i18n + auth middleware
├── messages/                 # i18n translation files
├── public/                   # Static assets
├── supabase/                 # Supabase migrations & seed
├── CLAUDE.md
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## Code Conventions

### Components
- One component per file; filename matches export name (PascalCase).
- Server Components by default; add `'use client'` only when strictly necessary.
- Props interfaces are defined inline above the component, never in a separate file unless shared.

### Styling
- Tailwind utility classes only — no inline `style={{}}` except for dynamic values unavailable in Tailwind.
- Class order: layout → flexbox/grid → sizing → spacing → typography → color → effects.
- Use `cn()` (clsx + tailwind-merge) for conditional class merging.

### Data fetching
- Server Components fetch directly from Supabase server client.
- Client Components use `useSWR` or React Query — never `useEffect` for data fetching.
- All Supabase queries must handle errors explicitly; never ignore `.error`.

### Naming
- Variables and functions: `camelCase`.
- Types and interfaces: `PascalCase`.
- Constants: `UPPER_SNAKE_CASE`.
- Files: `kebab-case` (except components which are `PascalCase.tsx`).

---

## Security

- Never expose Supabase `service_role` key client-side.
- Use Row Level Security (RLS) on every table — no exceptions.
- Validate all user input server-side with `zod` before writing to the DB.
- Environment variables prefixed `NEXT_PUBLIC_` are intentionally public; treat all others as secrets.

---

## Git Discipline

- Commits follow Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`.
- Never commit `.env*` files.
- Branch naming: `feat/short-description`, `fix/short-description`.

---

## Out of Scope (ask before proceeding)

- Changing the database schema without explicit approval.
- Adding new third-party dependencies without discussion.
- Modifying Supabase RLS policies.
- Deploying to production.
