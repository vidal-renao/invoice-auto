import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asUser, createUser, freshDatabase } from './harness'

const ALICE = '00000000-0000-4000-8000-00000000000a'
const BOB = '00000000-0000-4000-8000-00000000000b'

let db: PGlite

beforeAll(async () => {
  db = await freshDatabase()
  await createUser(db, ALICE)
  await createUser(db, BOB)
})

describe('008_reconcile_live_schema', () => {
  it('replays on a fresh clone and creates the columns the pipeline writes', async () => {
    const { rows } = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'invoices'`,
    )
    const columns = rows.map((r) => r.column_name)
    for (const c of ['due_date', 'client_name', 'client_email', 'client_phone', 'client_tax_id']) {
      expect(columns).toContain(c)
    }
  })

  it('is idempotent: applying it again changes nothing and leaves one DELETE policy', async () => {
    const sql = readFileSync(join(__dirname, '..', 'migrations', '008_reconcile_live_schema.sql'), 'utf8')
    await db.exec(sql)
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_policies where tablename = 'invoices' and cmd = 'DELETE'`,
    )
    expect(rows[0]?.n).toBe(1)
  })

  it('creates the DELETE policy when production lacks it', async () => {
    await db.exec(`drop policy "invoices: owner delete" on public.invoices`)
    const sql = readFileSync(join(__dirname, '..', 'migrations', '008_reconcile_live_schema.sql'), 'utf8')
    await db.exec(sql)
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_policies where tablename = 'invoices' and cmd = 'DELETE'`,
    )
    expect(rows[0]?.n).toBe(1)
  })

  it('lets an owner delete their invoice and nobody else', async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.invoices (user_id) values ($1) returning id`,
      [ALICE],
    )
    const id = rows[0]!.id

    const byBob = await asUser(db, BOB, (tx) =>
      tx.query(`delete from public.invoices where id = $1 returning id`, [id]),
    )
    expect(byBob.rows).toHaveLength(0)

    const byAlice = await asUser(db, ALICE, (tx) =>
      tx.query(`delete from public.invoices where id = $1 returning id`, [id]),
    )
    expect(byAlice.rows).toHaveLength(1)
  })
})
