import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations')

/**
 * The minimum of Supabase the migrations touch: the `auth` schema with
 * `auth.uid()`, the `storage` schema with buckets/objects/foldername, and
 * the `authenticated` role that RLS policies target.
 *
 * `auth.uid()` reads the same GUC PostgREST sets from the JWT, so a test
 * "logs in" exactly the way a real request does.
 */
const SUPABASE_STUB = `
  create role authenticated nologin;
  create role anon nologin;

  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select string_to_array(name, '/')
  $$;

  grant usage on schema public, auth, storage to authenticated;
  grant execute on function auth.uid() to authenticated;
  alter default privileges in schema public grant all on tables to authenticated;
  alter default privileges in schema public grant execute on functions to authenticated;
`

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

/** Fresh database with every repo migration applied, in order. */
export async function freshDatabase(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { uuid_ossp } })
  await db.exec(SUPABASE_STUB)
  for (const file of migrationFiles()) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`)
    }
  }
  return db
}

/** Creates an auth user; the signup trigger creates the profile. */
export async function createUser(db: PGlite, id: string, email = `${id.slice(0, 8)}@test.local`) {
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email])
}

/**
 * Runs `fn` as that user, with RLS enforced, inside a transaction that is
 * always rolled back afterwards unless `commit` is set.
 */
export async function asUser<T>(
  db: PGlite,
  userId: string,
  fn: (tx: Pick<PGlite, 'query' | 'exec'>) => Promise<T>,
  { commit = false }: { commit?: boolean } = {},
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated`)
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId])
    const result = await fn(tx)
    if (!commit) await tx.rollback()
    return result
  })
}
