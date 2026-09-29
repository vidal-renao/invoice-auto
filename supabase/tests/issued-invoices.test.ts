import { beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asUser, createUser, freshDatabase } from './harness'

/**
 * La emisión de facturas se prueba contra un Postgres real con las migraciones
 * aplicadas, porque las reglas que importan viven en la base de datos: la
 * numeración sin huecos, la aritmética que tiene que cuadrar y el registro
 * encadenado que no se puede tocar.
 */

const ANA = '00000000-0000-4000-8000-0000000000a1'
const LUIS = '00000000-0000-4000-8000-0000000000b2'

let db: PGlite

type Tx = Pick<PGlite, 'query' | 'exec'>

/** `asUser` abre una transacción: hay que usar la suya, no `db`, o se bloquea. */
async function nuevoCliente(tx: Tx, usuario: string, nombre = 'Cliente SL') {
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.bill_customers (user_id, name, tax_id, country)
     values ($1, $2, 'B12345678', 'ES') returning id`,
    [usuario, nombre],
  )
  return rows[0]!.id
}

/** Y por defecto hace rollback: lo que deba persistir se emite con commit. */
const COMMIT = { commit: true }

function emision(clienteId: string, neto = 100_000, serie = 'FA') {
  const iva = Math.round(neto * 0.21)
  return [
    clienteId,
    serie,
    '2026-09-28',
    'EUR',
    JSON.stringify({ case: 'domestic', vatRate: 0.21, legalMentions: [] }),
    JSON.stringify({ netCents: neto, vatCents: iva, totalCents: neto + iva }),
    JSON.stringify([
      { description: 'Servicio', quantityMilli: 1000, unitPriceCents: neto, netCents: neto },
    ]),
  ]
}

const EMITIR = `select public.bill_issue_invoice($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb) as id`

beforeEach(async () => {
  db = await freshDatabase()
  await createUser(db, ANA)
  await createUser(db, LUIS)
}, 120_000)

describe('emisión de facturas', () => {
  it('numera correlativamente y sin huecos dentro de la serie', async () => {
    const cliente = await asUser(db, ANA, (tx) => nuevoCliente(tx, ANA), COMMIT)

    const refs: string[] = []
    for (let i = 0; i < 3; i++) {
      await asUser(db, ANA, (tx) => tx.query(EMITIR, emision(cliente)), COMMIT)
      const { rows } = await db.query<{ reference: string }>(
        `select reference from public.bill_invoices where user_id = $1 order by number desc limit 1`,
        [ANA],
      )
      refs.push(rows[0]!.reference)
    }

    expect(refs).toEqual(['FA-2026/0001', 'FA-2026/0002', 'FA-2026/0003'])
  })

  it('cada serie lleva su propia numeración', async () => {
    const cliente = await asUser(db, ANA, (tx) => nuevoCliente(tx, ANA), COMMIT)
    await asUser(db, ANA, (tx) => tx.query(EMITIR, emision(cliente, 100_000, 'FA')), COMMIT)
    await asUser(db, ANA, (tx) => tx.query(EMITIR, emision(cliente, 100_000, 'REC')), COMMIT)

    const { rows } = await db.query<{ reference: string }>(
      `select reference from public.bill_invoices where user_id = $1 order by series`,
      [ANA],
    )
    expect(rows.map((r) => r.reference)).toEqual(['FA-2026/0001', 'REC-2026/0001'])
  })

  it('rechaza una factura cuyos importes no cuadran', async () => {
    const cliente = await asUser(db, ANA, (tx) => nuevoCliente(tx, ANA), COMMIT)
    const args = emision(cliente)
    // El total dice una cosa y sus partes dicen otra.
    args[5] = JSON.stringify({ netCents: 100_000, vatCents: 21_000, totalCents: 999_999 })

    await expect(asUser(db, ANA, (tx) => tx.query(EMITIR, args))).rejects.toThrow(
      /total does not match/,
    )
  })

  it('rechaza líneas que no suman la base imponible', async () => {
    const cliente = await asUser(db, ANA, (tx) => nuevoCliente(tx, ANA), COMMIT)
    const args = emision(cliente)
    args[6] = JSON.stringify([
      { description: 'Servicio', quantityMilli: 1000, unitPriceCents: 500, netCents: 500 },
    ])

    await expect(asUser(db, ANA, (tx) => tx.query(EMITIR, args))).rejects.toThrow(/lines sum/)
  })

  it('no deja emitir contra el cliente de otra persona', async () => {
    const deLuis = await asUser(db, LUIS, (tx) => nuevoCliente(tx, LUIS, 'Cliente de Luis'), COMMIT)

    await expect(
      asUser(db, ANA, (tx) => tx.query(EMITIR, emision(deLuis))),
    ).rejects.toThrow(/customer not found/)
  })

  it('calcula el vencimiento con las condiciones del cliente', async () => {
    const cliente = await asUser(db, ANA, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into public.bill_customers (user_id, name, country, payment_terms_days)
         values ($1, 'A 60 días', 'ES', 60) returning id`,
        [ANA],
      )
      return rows[0]!.id
    }, COMMIT)

    await asUser(db, ANA, (tx) => tx.query(EMITIR, emision(cliente)), COMMIT)
    const { rows } = await db.query<{ issue_date: string; due_date: string }>(
      `select issue_date::text, due_date::text from public.bill_invoices where user_id = $1`,
      [ANA],
    )
    expect(rows[0]!.issue_date).toBe('2026-09-28')
    expect(rows[0]!.due_date).toBe('2026-11-27')
  })

  it('encadena el registro de facturación y no deja alterarlo', async () => {
    const cliente = await asUser(db, ANA, (tx) => nuevoCliente(tx, ANA), COMMIT)
    await asUser(db, ANA, (tx) => tx.query(EMITIR, emision(cliente)), COMMIT)
    await asUser(db, ANA, (tx) => tx.query(EMITIR, emision(cliente, 200_000)), COMMIT)

    const { rows } = await db.query<{ hash: string; previous_hash: string | null }>(
      `select hash, previous_hash from public.bill_records where user_id = $1 order by id`,
      [ANA],
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]!.previous_hash).toBeNull()
    expect(rows[1]!.previous_hash).toBe(rows[0]!.hash)
    expect(rows[0]!.hash).toMatch(/^[0-9a-f]{64}$/)

    await expect(
      db.query(`update public.bill_records set hash = 'x' where user_id = $1`, [ANA]),
    ).rejects.toThrow(/append-only/)
    await expect(
      db.query(`delete from public.bill_records where user_id = $1`, [ANA]),
    ).rejects.toThrow(/append-only/)
  })

  it('cada usuario tiene su propia cadena y no ve la ajena', async () => {
    const deAna = await asUser(db, ANA, (tx) => nuevoCliente(tx, ANA), COMMIT)
    const deLuis = await asUser(db, LUIS, (tx) => nuevoCliente(tx, LUIS), COMMIT)
    await asUser(db, ANA, (tx) => tx.query(EMITIR, emision(deAna)), COMMIT)
    await asUser(db, LUIS, (tx) => tx.query(EMITIR, emision(deLuis)), COMMIT)

    const visto = await asUser(db, LUIS, (tx) =>
      tx.query<{ n: number }>(`select count(*)::int as n from public.bill_invoices`),
    )
    expect(visto.rows[0]!.n).toBe(1)

    const { rows } = await db.query<{ previous_hash: string | null }>(
      `select previous_hash from public.bill_records where user_id = $1`,
      [LUIS],
    )
    // La primera factura de Luis abre su cadena; no cuelga de la de Ana.
    expect(rows[0]!.previous_hash).toBeNull()
  })

  it('el cliente no puede escribir facturas directamente', async () => {
    const cliente = await asUser(db, ANA, (tx) => nuevoCliente(tx, ANA), COMMIT)
    const intento = asUser(db, ANA, (tx) =>
      tx.query(
        `insert into public.bill_invoices
           (user_id, customer_id, series, year, number, reference, issue_date, due_date,
            currency, tax_case, net_cents, vat_cents, total_cents)
         values ($1, $2, 'FA', 2026, 99, 'FA-2026/0099', '2026-09-28', '2026-10-28',
                 'EUR', 'domestic', 100, 21, 121)`,
        [ANA, cliente],
      ),
    )
    await expect(intento).rejects.toThrow()
  })

  it('marca como cobrada solo una vez', async () => {
    const cliente = await asUser(db, ANA, (tx) => nuevoCliente(tx, ANA), COMMIT)
    await asUser(db, ANA, (tx) => tx.query(EMITIR, emision(cliente)), COMMIT)
    const { rows } = await db.query<{ id: string }>(
      `select id from public.bill_invoices where user_id = $1`,
      [ANA],
    )
    const id = rows[0]!.id

    await asUser(db, ANA, (tx) => tx.query(`select public.bill_mark_paid($1)`, [id]), COMMIT)
    const cobrada = await db.query<{ status: string }>(
      `select status from public.bill_invoices where id = $1`,
      [id],
    )
    expect(cobrada.rows[0]!.status).toBe('paid')

    await expect(
      asUser(db, ANA, (tx) => tx.query(`select public.bill_mark_paid($1)`, [id])),
    ).rejects.toThrow(/not found or not issued/)
  })
})
