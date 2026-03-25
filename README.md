# Invoice Auto

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth%20%2B%20Storage-3ecf8e?logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)
![Vercel](https://img.shields.io/badge/Vercel-deployed-black?logo=vercel)
![Claude API](https://img.shields.io/badge/Claude-claude--opus--4--6-7c3aed?logo=anthropic)
![License](https://img.shields.io/badge/license-private-red)

**AI-powered invoice management for freelancers and SMEs operating across Spain and Switzerland.**

Upload a receipt photo or PDF → Claude extracts every field → review and approve in seconds.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser / PWA)               │
│  Next.js 16 App Router · React 19 · Tailwind v4             │
│                                                             │
│  ScanTicketButton ──► supabase.storage.from('invoices')     │
│         │                        │                          │
│         ▼                        ▼                          │
│  createInvoiceRecord()    Supabase Storage                  │
│  (Server Action)          (RLS: auth.uid() scoped)          │
│         │                                                   │
│         ▼                                                   │
│  analyzeReceipt()                                           │
│  (Server Action)                                            │
│         │                                                   │
│         ▼                                                   │
│  Anthropic Claude API                                       │
│  (claude-opus-4-6 + Zod structured output)                  │
│         │                                                   │
│         ▼                                                   │
│  public.invoices (Postgres · RLS · cents · UTC)             │
└─────────────────────────────────────────────────────────────┘
                              │
               ┌──────────────┴──────────────┐
               │                             │
          Vercel Edge                   Supabase
        (i18n middleware)         (Postgres + Auth + Storage)
```

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 16 (App Router) | Turbopack, RSC-first |
| Language | TypeScript 5 strict | `noUncheckedIndexedAccess` |
| Styling | Tailwind CSS v4 | Dark-mode first, JIT purge |
| Backend | Supabase | Postgres 15, Row Level Security |
| Auth | Supabase Auth | SSR cookies via `@supabase/ssr` |
| Storage | Supabase Storage | Private `invoices` bucket, signed URLs |
| AI | Claude API (`claude-opus-4-6`) | Vision + structured output via Zod |
| Validation | Zod 3 | Server-side only, before any DB write |
| i18n | next-intl | Locales: `es` (default), `de`, `en` |
| Deployment | Vercel | Edge middleware, auto-preview deploys |
| PWA | Custom SW | Cache-first static, network-first nav |

---

## Advanced Engineering Decisions

### 1. Monetary amounts in integer cents
All prices (`subtotal_cents`, `tax_cents`, `total_cents`) are stored as `INTEGER` in Postgres.
Floating-point arithmetic on currency values causes rounding errors that compound across reports. Integer cents are exact, sortable, and trivially serialisable to every locale via `Intl.NumberFormat`.

### 2. Row Level Security on every surface
Both the `invoices` Postgres table and the `invoices` Storage bucket enforce `auth.uid()` policies at the database level. No application-layer filtering can accidentally expose another user's data — the database rejects the query before any row is returned.

```sql
-- Storage INSERT policy (bank-grade example)
create policy "invoices: owner upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

### 3. Zod validation before every DB write
Every data path that writes to Postgres is guarded by a Zod schema (`src/lib/validations/invoice.ts`).
This prevents corrupt AI output, malformed API payloads, and type drift between the DB schema and TypeScript types from ever reaching the database.

### 4. Server Components by default
All data fetching happens in React Server Components directly against the Supabase server client. Zero client-side secrets, zero waterfall round-trips, zero `useEffect` data fetching.

### 5. Structured logging for Vercel
`src/lib/logger.ts` emits newline-delimited JSON in production — compatible with Vercel Log Drains, Datadog, and Logtail. Every AI call and Storage operation is tagged and traceable.

---

## Project Structure

```
src/
├── app/[locale]/           # Localised App Router pages
│   ├── (auth)/             # Login / Register
│   └── (dashboard)/        # Dashboard, Invoices
├── components/
│   ├── dashboard/          # ScanTicketButton, StatCard, Sidebar
│   └── ui/                 # Button, Input, Card primitives
├── lib/
│   ├── actions/            # Server Actions: invoices.ts, ai.ts
│   ├── supabase/           # client.ts, server.ts, builder.ts
│   ├── validations/        # invoice.ts (Zod schemas)
│   └── logger.ts           # Structured logger
├── types/
│   └── database.ts         # Supabase DB types (hand-authored)
└── middleware.ts            # i18n + auth session refresh

messages/                   # i18n: es.json, de.json, en.json
supabase/migrations/        # 001_profiles · 002_invoices · 003_receipts · 004_invoices_bucket
public/
├── manifest.json           # PWA manifest (maskable icons, shortcuts)
└── sw.js                   # Service Worker (cache-first / network-first)
```

---

## Fiscal Coverage

| Country | Tax | Validation |
|---------|-----|-----------|
| Spain | IVA 4% / 10% / 21% | NIF / CIF format |
| Switzerland | VAT 8.1% | UID `CHE-xxx.xxx.xxx` format |

---

## AI Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Receipt OCR via Claude Vision | ✅ Live |
| 2 | Structured output with Zod validation | ✅ Live |
| 3 | Automatic NIF/UID verification against public registries | 🔜 Planned |
| 4 | Expense categorisation (travel, supplies, services…) | 🔜 Planned |
| 5 | Quarterly IVA summary export (Modelo 303) | 🔜 Planned |
| 6 | VeriFactu compliance layer (Spain 2025 mandate) | 🔜 Planned |
| 7 | Multi-currency reconciliation (EUR ↔ CHF) | 🔜 Planned |

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.local.example .env.local
# → Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ANTHROPIC_API_KEY

# 3. Apply DB migrations (Supabase SQL Editor or CLI)
supabase db push

# 4. Run development server
npm run dev
```

---

## Deployment

```bash
# Create private GitHub repo and push
gh repo create invoice-auto --private --source=. --remote=origin --push

# Vercel auto-deploys on push to main
# Add env vars in: Vercel Dashboard → Project → Settings → Environment Variables
```

---

*Built with Next.js 16, Supabase, and Claude API.*
