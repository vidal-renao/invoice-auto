import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asUser, createUser, freshDatabase } from './harness'

const ALICE = '00000000-0000-4000-8000-00000000000a'
const BOB = '00000000-0000-4000-8000-00000000000b'

const OWNED_TABLES = ['invoices', 'vendors', 'profiles'] as const

let db: PGlite

beforeAll(async () => {
  db = await freshDatabase()
  await createUser(db, ALICE)
  await createUser(db, BOB)
})

describe('010_policy_hygiene', () => {
  it('leaves exactly one permissive policy per table and action', async () => {
    const { rows } = await db.query<{ tablename: string; cmd: string; n: number }>(
      `select tablename, cmd, count(*)::int as n
         from pg_policies
        where schemaname = 'public' and tablename = any($1)
        group by tablename, cmd
       having count(*) > 1`,
      [OWNED_TABLES],
    )
    expect(rows).toEqual([])
  })

  it('scopes every policy to authenticated, never to anon', async () => {
    const { rows } = await db.query<{ tablename: string; policyname: string; roles: string }>(
      `select tablename, policyname, roles::text as roles
         from pg_policies
        where schemaname = 'public' and tablename = any($1)
          and roles::text <> '{authenticated}'`,
      [OWNED_TABLES],
    )
    expect(rows).toEqual([])
  })

  it('evaluates auth.uid() once per statement rather than once per row', async () => {
    // An unwrapped `auth.uid()` is re-run for every row scanned. The scalar
    // subquery form is what makes Postgres hoist it into an InitPlan.
    const { rows } = await db.query<{ tablename: string; policyname: string; expr: string }>(
      `select tablename, policyname, coalesce(qual, with_check) as expr
         from pg_policies
        where schemaname = 'public' and tablename = any($1)
          and coalesce(qual, '') || coalesce(with_check, '') ~ 'auth\\.uid\\(\\)'
          and coalesce(qual, '') || coalesce(with_check, '') !~ '\\( SELECT auth\\.uid\\(\\)'`,
      [OWNED_TABLES],
    )
    expect(rows).toEqual([])
  })

  it('still isolates invoices between users after the rebuild', async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.invoices (user_id) values ($1) returning id`,
      [ALICE],
    )
    const id = rows[0]!.id

    const bobSees = await asUser(db, BOB, (tx) =>
      tx.query(`select id from public.invoices where id = $1`, [id]),
    )
    expect(bobSees.rows).toHaveLength(0)

    const aliceSees = await asUser(db, ALICE, (tx) =>
      tx.query(`select id from public.invoices where id = $1`, [id]),
    )
    expect(aliceSees.rows).toHaveLength(1)
  })

  it('refuses to let a user create an invoice owned by someone else', async () => {
    const inserted = await asUser(db, BOB, async (tx) => {
      try {
        return await tx.query(
          `insert into public.invoices (user_id) values ($1) returning id`,
          [ALICE],
        )
      } catch {
        return { rows: [] }
      }
    })
    expect(inserted.rows).toHaveLength(0)
  })

  it('refuses to let a user hand their invoice to someone else', async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.invoices (user_id) values ($1) returning id`,
      [ALICE],
    )
    const id = rows[0]!.id

    const moved = await asUser(db, ALICE, async (tx) => {
      try {
        return await tx.query(
          `update public.invoices set user_id = $1 where id = $2 returning id`,
          [BOB, id],
        )
      } catch {
        return { rows: [] }
      }
    })
    expect(moved.rows).toHaveLength(0)
  })

  it('removes the hand-made duplicates that production actually has', async () => {
    // A fresh database gets the clean names from 002, so the drops above are
    // no-ops there. Production is not a fresh database: it carries five
    // policies written by hand in the dashboard, two of them duplicates.
    // Recreate that state and prove the migration converges on it.
    await db.exec(`
      create policy "Users can view own invoices"         on public.invoices for select using (auth.uid() = user_id);
      create policy "Users can view their own invoices"   on public.invoices for select using (auth.uid() = user_id);
      create policy "Users can insert own invoices"       on public.invoices for insert with check (auth.uid() = user_id);
      create policy "Users can insert their own invoices" on public.invoices for insert with check (auth.uid() = user_id);
      create policy "Users can update their own invoices" on public.invoices for update using (auth.uid() = user_id);
    `)

    const before = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_policies where schemaname='public' and tablename='invoices'`,
    )
    expect(before.rows[0]?.n).toBe(9)

    const sql = readFileSync(join(__dirname, '..', 'migrations', '010_policy_hygiene.sql'), 'utf8')
    await db.exec(sql)

    const after = await db.query<{ policyname: string; cmd: string; roles: string }>(
      `select policyname, cmd, roles::text as roles from pg_policies
        where schemaname='public' and tablename='invoices' order by cmd`,
    )
    expect(after.rows.map((r) => r.policyname).sort()).toEqual([
      'invoices: owner delete',
      'invoices: owner insert',
      'invoices: owner select',
      'invoices: owner update',
    ])
    expect(after.rows.every((r) => r.roles === '{authenticated}')).toBe(true)

    // The rebuilt policies must still isolate users.
    const { rows } = await db.query<{ id: string }>(
      `insert into public.invoices (user_id) values ($1) returning id`,
      [ALICE],
    )
    const bobSees = await asUser(db, BOB, (tx) =>
      tx.query(`select id from public.invoices where id = $1`, [rows[0]!.id]),
    )
    expect(bobSees.rows).toHaveLength(0)
  })

  it('is idempotent', async () => {
    const sql = readFileSync(join(__dirname, '..', 'migrations', '010_policy_hygiene.sql'), 'utf8')
    await db.exec(sql)

    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_policies
        where schemaname = 'public' and tablename = any($1)`,
      [OWNED_TABLES],
    )
    // 4 on invoices, 4 on vendors, 2 on profiles.
    expect(rows[0]?.n).toBe(10)
  })
})
