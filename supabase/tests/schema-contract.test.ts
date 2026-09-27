import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { freshDatabase } from './harness'

/**
 * The application talks to the database through the hand-written types in
 * src/types/database.ts. Nothing checked that those types matched the
 * migrations, and they drifted: `profiles.locale` existed in the type and in
 * the settings form, but no migration ever created the column. Every save on
 * the settings page failed with
 *
 *   Could not find the 'locale' column of 'profiles' in the schema cache
 *
 * and took the name, company and tax id down with it, because they are written
 * in the same statement.
 *
 * This test replays the migrations into a real Postgres and asserts that every
 * column the types promise actually exists. It fails loudly the next time a
 * type gains a field that no migration created.
 */

const TYPES_FILE = join(__dirname, '..', '..', 'src', 'types', 'database.ts')

/** Pull the `Row` field names of each table out of the types file. */
function declaredColumns(): Map<string, string[]> {
  // The repository stores files with CRLF on Windows; the patterns below are
  // written against \n, so normalise first.
  const source = readFileSync(TYPES_FILE, 'utf8').replace(/\r\n/g, '\n')
  const tables = new Map<string, string[]>()

  // "      tableName: {\n        Row: {\n          field: type\n ... }"
  const tableRe = /^ {6}(\w+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/gm
  let match: RegExpExecArray | null

  while ((match = tableRe.exec(source)) !== null) {
    const [, table, body] = match
    const columns = (body ?? '')
      .split('\n')
      .map((line) => /^ {10}(\w+)\??:/.exec(line)?.[1])
      .filter((name): name is string => Boolean(name))
    if (table && columns.length) tables.set(table, columns)
  }

  return tables
}

let db: PGlite
let actual: Map<string, Set<string>>

beforeAll(async () => {
  db = await freshDatabase()
  const { rows } = await db.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns
     where table_schema = 'public'`,
  )
  actual = new Map()
  for (const row of rows) {
    if (!actual.has(row.table_name)) actual.set(row.table_name, new Set())
    actual.get(row.table_name)!.add(row.column_name)
  }
}, 60_000)

describe('database types match the migrations', () => {
  it('finds tables to check', () => {
    const declared = declaredColumns()
    expect(declared.size).toBeGreaterThan(0)
    expect([...declared.keys()]).toContain('profiles')
  })

  it('every column the application types promise exists in the schema', () => {
    const missing: string[] = []

    for (const [table, columns] of declaredColumns()) {
      const live = actual.get(table)
      if (!live) {
        missing.push(`${table} (table missing entirely)`)
        continue
      }
      for (const column of columns) {
        if (!live.has(column)) missing.push(`${table}.${column}`)
      }
    }

    expect(missing).toEqual([])
  })

  it('profiles.locale exists and only accepts the three shipped locales', async () => {
    const columns = actual.get('profiles')
    expect(columns).toBeDefined()
    expect(columns!.has('locale')).toBe(true)

    await expect(
      db.exec(`insert into public.profiles (id, email, country, locale)
               values ('00000000-0000-4000-8000-0000000000ff', 'x@test.local', 'ES', 'fr')`),
    ).rejects.toThrow()
  })
})
