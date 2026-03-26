/**
 * Typed query-builder shim for hand-written Database types that fail
 * GenericSchema inference in @supabase/supabase-js.
 *
 * Replace with `supabase gen types typescript` for authoritative types —
 * at that point, remove this file and call `supabase.from()` directly.
 */

// Minimal interfaces that cover the query shapes used in this project.
// Extend as new query patterns are needed.

export interface SelectBuilder<TRow> {
  eq(col: string, val: unknown): SelectBuilder<TRow>
  in(col: string, vals: unknown[]): SelectBuilder<TRow>
  gte(col: string, val: unknown): SelectBuilder<TRow>
  lt(col: string, val: unknown): SelectBuilder<TRow>
  order(col: string, opts?: { ascending: boolean }): SelectBuilder<TRow>
  select(cols: string, opts?: { count: 'exact'; head: boolean }): SelectBuilder<TRow>
  single(): Promise<{ data: TRow | null; error: { message: string } | null }>
  then: Promise<{
    data: TRow[] | null
    count: number | null
    error: { message: string } | null
  }>['then']
}

export interface InsertBuilder<TRow> {
  select(cols: string): {
    single(): Promise<{ data: TRow | null; error: { message: string } | null }>
  }
}

export interface UpdateBuilder {
  eq(col: string, val: unknown): UpdateBuilder
  then: Promise<{ error: { message: string } | null }>['then']
}

export interface TableBuilder<TRow, TInsert> {
  select(cols: string, opts?: { count: 'exact'; head: boolean }): SelectBuilder<TRow>
  insert(values: TInsert): InsertBuilder<TRow>
  update(values: Record<string, unknown>): UpdateBuilder
}

/**
 * Returns a strongly-typed query builder for a table, bypassing the
 * GenericSchema inference that fails on hand-written Database types.
 *
 * Usage:
 *   const qb = typedFrom<Invoice, InvoiceInsert>(supabase, 'invoices')
 *   const { data } = await qb.select('*').eq('user_id', userId).single()
 */
export function typedFrom<TRow, TInsert>(
  // Accept any object with a `from` method — avoids GenericSchema inference failures
  // on hand-written Database types that don't fully satisfy the SupabaseClient generic.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from(table: string): any },
  tableName: string
): TableBuilder<TRow, TInsert> {
  return client.from(tableName) as TableBuilder<TRow, TInsert>
}
