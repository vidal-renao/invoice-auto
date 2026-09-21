import { beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asUser, createUser, freshDatabase } from './harness'

const ALICE = '00000000-0000-4000-8000-00000000000a'
const BOB = '00000000-0000-4000-8000-00000000000b'
const ES_IBAN = 'ES9121000418450200051332'
const DE_IBAN = 'DE89370400440532013000'
const FP = 'a'.repeat(64)

let db: PGlite

beforeEach(async () => {
  db = await freshDatabase()
  await createUser(db, ALICE)
  await createUser(db, BOB)
})

async function invoice(user: string, over: { status?: string; total?: number; currency?: string } = {}) {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.invoices (user_id, status, total_cents, currency, vendor_name)
     values ($1, $2, $3, $4, 'Acme SL') returning id`,
    [user, over.status ?? 'approved', over.total ?? 121_000, over.currency ?? 'EUR'],
  )
  return rows[0]!.id
}

type Tx = Parameters<Parameters<typeof asUser>[2]>[0]

async function register(tx: Tx, iban = ES_IBAN, key = 'tax:B12345678') {
  const { rows } = await tx.query<{ id: string }>(
    `select public.pay_register_account($1, 'Acme SL', $2, 'manual', null) as id`,
    [key, iban],
  )
  return rows[0]!.id
}

async function verify(tx: Tx, id: string, contact = '+34 600 000 000 (ficha de alta)') {
  await tx.query(`select public.pay_verify_account($1, 'phone_callback', $2, 'Llamada al número de la ficha')`, [
    id,
    contact,
  ])
}

function item(invoiceId: string, accountId: string, over: Record<string, unknown> = {}) {
  return {
    invoice_id: invoiceId,
    account_id: accountId,
    amount_cents: 121_000,
    currency: 'EUR',
    end_to_end_id: `E2E-${invoiceId.slice(0, 8)}`,
    requested_execution_date: '2026-09-30',
    ...over,
  }
}

async function createBatch(tx: Tx, items: unknown[], messageId = 'IA-TEST-1') {
  const { rows } = await tx.query<{ id: string }>(
    `select public.pay_create_batch($1, '<xml/>', $2::jsonb, '[]'::jsonb) as id`,
    [messageId, JSON.stringify(items)],
  )
  return rows[0]!.id
}

async function auditActions(user: string) {
  const { rows } = await db.query<{ action: string }>(
    `select action from public.pay_audit_log where user_id = $1 order by id`,
    [user],
  )
  return rows.map((r) => r.action)
}

describe('pay_iban_valid (database copy of the checksum)', () => {
  it('agrees with the published examples', async () => {
    const { rows } = await db.query<{ ok: boolean; bad: boolean; ch: boolean }>(
      `select public.pay_iban_valid($1) ok, public.pay_iban_valid($2) bad, public.pay_iban_valid($3) ch`,
      [ES_IBAN, 'ES9121000418450200051333', 'CH4431999123000889012'],
    )
    expect(rows[0]).toEqual({ ok: true, bad: false, ch: true })
  })
})

describe('the client can read but never write pay_* tables', () => {
  it.each(['pay_supplier_accounts', 'pay_batches', 'pay_payments', 'pay_audit_log', 'pay_settings', 'pay_overrides'])(
    'direct INSERT into %s is denied',
    async (table) => {
      await expect(
        asUser(db, ALICE, (tx) => tx.query(`insert into public.${table} default values`)),
      ).rejects.toThrow(/permission denied/)
    },
  )

  it('cannot flip an account to verified with a plain UPDATE', async () => {
    const id = await asUser(db, ALICE, (tx) => register(tx), { commit: true })
    await expect(
      asUser(db, ALICE, (tx) =>
        tx.query(`update public.pay_supplier_accounts set status = 'verified' where id = $1`, [id]),
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it('anon cannot call the commands', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.exec('set local role anon')
        await tx.query(`select public.pay_reject_account(gen_random_uuid(), 'nope')`)
      }),
    ).rejects.toThrow(/permission denied/)
  })

  it('a command without a logged-in user is refused', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.exec('set local role authenticated')
        await tx.query(`select public.pay_register_account('tax:X12345', 'X', $1, 'manual', null)`, [ES_IBAN])
      }),
    ).rejects.toThrow(/not authenticated/)
  })
})

describe('row level security', () => {
  it('each user sees only their own accounts', async () => {
    await asUser(db, ALICE, (tx) => register(tx), { commit: true })
    const seenByBob = await asUser(db, BOB, (tx) => tx.query(`select id from public.pay_supplier_accounts`))
    expect(seenByBob.rows).toHaveLength(0)
    const seenByAlice = await asUser(db, ALICE, (tx) => tx.query(`select id from public.pay_supplier_accounts`))
    expect(seenByAlice.rows).toHaveLength(1)
  })

  it("another user cannot verify, reject or pay into someone else's account", async () => {
    const id = await asUser(db, ALICE, (tx) => register(tx), { commit: true })
    await expect(asUser(db, BOB, (tx) => verify(tx, id))).rejects.toThrow(/account not found/)
    await expect(
      asUser(db, BOB, (tx) => tx.query(`select public.pay_reject_account($1, 'fraude')`, [id])),
    ).rejects.toThrow(/account not found/)
  })

  it("another user cannot put someone else's invoice in a batch", async () => {
    const inv = await invoice(ALICE)
    const acc = await asUser(db, BOB, async (tx) => {
      const id = await register(tx)
      await verify(tx, id)
      return id
    }, { commit: true })
    await expect(asUser(db, BOB, (tx) => createBatch(tx, [item(inv, acc)]))).rejects.toThrow(/not found/)
  })
})

describe('supplier accounts', () => {
  it('registers a first account unverified, and re-registering the same IBAN is a no-op', async () => {
    const [a, b] = await asUser(db, ALICE, async (tx) => [await register(tx), await register(tx)], { commit: true })
    expect(a).toBe(b)
    const { rows } = await db.query<{ status: string; is_change: boolean }>(
      `select status, is_change from public.pay_supplier_accounts`,
    )
    expect(rows).toEqual([{ status: 'pending_verification', is_change: false }])
    expect(await auditActions(ALICE)).toEqual(['account_registered'])
  })

  it('rejects an invalid IBAN at the database too', async () => {
    await expect(asUser(db, ALICE, (tx) => register(tx, 'ES9121000418450200051333'))).rejects.toThrow(/invalid IBAN/)
  })

  it('a new IBAN supersedes the live one and is marked as a change', async () => {
    await asUser(db, ALICE, async (tx) => {
      const first = await register(tx)
      await verify(tx, first)
      await register(tx, DE_IBAN)
    }, { commit: true })

    const { rows } = await db.query<{ iban: string; status: string; is_change: boolean }>(
      `select iban, status, is_change from public.pay_supplier_accounts order by registered_at, status desc`,
    )
    expect(rows).toContainEqual({ iban: ES_IBAN, status: 'superseded', is_change: false })
    expect(rows).toContainEqual({ iban: DE_IBAN, status: 'pending_verification', is_change: true })
    expect(await auditActions(ALICE)).toEqual(['account_registered', 'account_verified', 'account_changed'])
  })

  it('verification needs the known contact that was used', async () => {
    const id = await asUser(db, ALICE, (tx) => register(tx), { commit: true })
    await expect(asUser(db, ALICE, (tx) => verify(tx, id, '  '))).rejects.toThrow(/known contact/)
  })

  it('a first account has no cooling-off; a changed one waits the configured hours', async () => {
    const result = await asUser(db, ALICE, async (tx) => {
      const first = await register(tx)
      await verify(tx, first)
      const changed = await register(tx, DE_IBAN)
      await verify(tx, changed)
      const { rows } = await tx.query<{ iban: string; hours: number | null }>(
        `select iban, extract(epoch from cooling_off_until - verified_at) / 3600 as hours
         from public.pay_supplier_accounts where status = 'verified'`,
      )
      const firstRow = await tx.query<{ c: string | null }>(
        `select cooling_off_until::text c from public.pay_supplier_accounts where id = $1`,
        [first],
      )
      return { changed: rows[0], first: firstRow.rows[0] }
    })
    expect(result.first?.c).toBeNull()
    expect(Math.round(Number(result.changed?.hours))).toBe(72)
  })

  it('cannot verify twice or verify a rejected account', async () => {
    const id = await asUser(db, ALICE, async (tx) => {
      const acc = await register(tx)
      await tx.query(`select public.pay_reject_account($1, 'IBAN recibido por email no solicitado')`, [acc])
      return acc
    }, { commit: true })
    await expect(asUser(db, ALICE, (tx) => verify(tx, id))).rejects.toThrow(/not pending verification/)
  })
})

describe('payment batches', () => {
  async function verifiedAccount(user = ALICE) {
    return asUser(db, user, async (tx) => {
      const id = await register(tx)
      await verify(tx, id)
      return id
    }, { commit: true })
  }

  it('creates a batch with its payments and totals, and audits it', async () => {
    const acc = await verifiedAccount()
    const inv1 = await invoice(ALICE)
    const inv2 = await invoice(ALICE, { total: 5_000 })
    const batch = await asUser(
      db,
      ALICE,
      (tx) => createBatch(tx, [item(inv1, acc), item(inv2, acc, { amount_cents: 5_000 })]),
      { commit: true },
    )
    const { rows } = await db.query<{ tx_count: number; control_sum_cents: string; currencies: string[] }>(
      `select tx_count, control_sum_cents::text, currencies from public.pay_batches where id = $1`,
      [batch],
    )
    expect(rows[0]).toEqual({ tx_count: 2, control_sum_cents: '126000', currencies: ['EUR'] })
    expect(await auditActions(ALICE)).toContain('batch_created')
  })

  it('refuses an unverified account, whatever the application decided', async () => {
    const acc = await asUser(db, ALICE, (tx) => register(tx), { commit: true })
    const inv = await invoice(ALICE)
    await expect(asUser(db, ALICE, (tx) => createBatch(tx, [item(inv, acc)]))).rejects.toThrow(/not verified/)
  })

  it('refuses an account still in cooling-off', async () => {
    const acc = await asUser(db, ALICE, async (tx) => {
      const first = await register(tx)
      await verify(tx, first)
      const changed = await register(tx, DE_IBAN)
      await verify(tx, changed)
      return changed
    }, { commit: true })
    const inv = await invoice(ALICE)
    await expect(asUser(db, ALICE, (tx) => createBatch(tx, [item(inv, acc)]))).rejects.toThrow(/cooling-off/)
  })

  it('refuses an invoice that is not approved', async () => {
    const acc = await verifiedAccount()
    const inv = await invoice(ALICE, { status: 'review_needed' })
    await expect(asUser(db, ALICE, (tx) => createBatch(tx, [item(inv, acc)]))).rejects.toThrow(/not approved/)
  })

  it('refuses an amount or currency that differs from the invoice', async () => {
    const acc = await verifiedAccount()
    const inv = await invoice(ALICE)
    await expect(
      asUser(db, ALICE, (tx) => createBatch(tx, [item(inv, acc, { amount_cents: 999 })])),
    ).rejects.toThrow(/amount/)
    await expect(
      asUser(db, ALICE, (tx) => createBatch(tx, [item(inv, acc, { currency: 'CHF' })])),
    ).rejects.toThrow(/currency/)
  })

  it('never schedules the same invoice twice, and a failing batch leaves nothing behind', async () => {
    const acc = await verifiedAccount()
    const inv = await invoice(ALICE)
    await asUser(db, ALICE, (tx) => createBatch(tx, [item(inv, acc)], 'IA-1'), { commit: true })

    const other = await invoice(ALICE, { total: 7_000 })
    await expect(
      asUser(
        db,
        ALICE,
        (tx) => createBatch(tx, [item(other, acc, { amount_cents: 7_000 }), item(inv, acc, { end_to_end_id: 'E2E-X' })], 'IA-2'),
        { commit: true },
      ),
    ).rejects.toThrow(/pay_payments_one_open_per_invoice/)

    const { rows } = await db.query<{ n: number }>(`select count(*)::int n from public.pay_batches`)
    expect(rows[0]?.n).toBe(1)
  })

  it('cancelling a batch releases its invoices; an executed batch can be neither cancelled nor re-executed', async () => {
    const acc = await verifiedAccount()
    const inv = await invoice(ALICE)
    const first = await asUser(db, ALICE, (tx) => createBatch(tx, [item(inv, acc)], 'IA-1'), { commit: true })
    await asUser(db, ALICE, (tx) => tx.query(`select public.pay_cancel_batch($1, 'Importe a revisar')`, [first]), {
      commit: true,
    })

    const second = await asUser(db, ALICE, (tx) => createBatch(tx, [item(inv, acc)], 'IA-2'), { commit: true })
    await asUser(db, ALICE, (tx) => tx.query(`select public.pay_mark_batch_executed($1)`, [second]), { commit: true })

    const { rows } = await db.query<{ status: string }>(
      `select status from public.pay_payments where invoice_id = $1 order by created_at`,
      [inv],
    )
    expect(rows.map((r) => r.status)).toEqual(['cancelled', 'paid'])

    await expect(
      asUser(db, ALICE, (tx) => tx.query(`select public.pay_cancel_batch($1, 'demasiado tarde')`, [second])),
    ).rejects.toThrow(/only a generated batch/)
    await expect(
      asUser(db, ALICE, (tx) => tx.query(`select public.pay_mark_batch_executed($1)`, [second])),
    ).rejects.toThrow(/already executed/)
  })

  it('an account with money in an open batch cannot be rejected until the batch is cancelled', async () => {
    const acc = await verifiedAccount()
    const inv = await invoice(ALICE)
    await asUser(db, ALICE, (tx) => createBatch(tx, [item(inv, acc)]), { commit: true })
    await expect(
      asUser(db, ALICE, (tx) => tx.query(`select public.pay_reject_account($1, 'sospecha de fraude')`, [acc])),
    ).rejects.toThrow(/open batch/)
  })

  it('an invoice with a payment cannot be deleted', async () => {
    const acc = await verifiedAccount()
    const inv = await invoice(ALICE)
    await asUser(db, ALICE, (tx) => createBatch(tx, [item(inv, acc)]), { commit: true })
    await expect(
      asUser(db, ALICE, (tx) => tx.query(`delete from public.invoices where id = $1`, [inv])),
    ).rejects.toThrow(/foreign key/)
  })
})

describe('reviews', () => {
  it('records an accepted review with its note and fingerprint', async () => {
    const inv = await invoice(ALICE)
    await asUser(
      db,
      ALICE,
      (tx) =>
        tx.query(`select public.pay_accept_review($1, $2, 'Contrato anual firmado', '["amount_above_threshold"]')`, [
          inv,
          FP,
        ]),
      { commit: true },
    )
    const { rows } = await db.query<{ fingerprint: string }>(`select fingerprint from public.pay_overrides`)
    expect(rows).toEqual([{ fingerprint: FP }])
    expect(await auditActions(ALICE)).toEqual(['review_accepted'])
  })

  it('refuses an acceptance without a real note', async () => {
    const inv = await invoice(ALICE)
    await expect(
      asUser(db, ALICE, (tx) => tx.query(`select public.pay_accept_review($1, $2, ' ', '[]')`, [inv, FP])),
    ).rejects.toThrow(/check constraint/)
  })
})

describe('audit log is append-only', () => {
  beforeEach(async () => {
    await asUser(db, ALICE, (tx) => register(tx), { commit: true })
  })

  it('rejects UPDATE, DELETE and TRUNCATE, even for the database owner', async () => {
    await expect(db.query(`update public.pay_audit_log set action = 'x'`)).rejects.toThrow(/append-only/)
    await expect(db.query(`delete from public.pay_audit_log`)).rejects.toThrow(/append-only/)
    await expect(db.query(`truncate public.pay_audit_log`)).rejects.toThrow(/append-only/)
  })

  it('stores masked IBANs, never the full account number', async () => {
    const { rows } = await db.query<{ details: { iban: string } }>(`select details from public.pay_audit_log`)
    expect(rows[0]?.details.iban).toBe('ES91 •••• 1332')
    expect(JSON.stringify(rows)).not.toContain(ES_IBAN)
  })
})
