-- ============================================================
-- Migration: 013_issued_invoices
--
-- Emisión de facturas. Hasta ahora `invoices` eran facturas RECIBIDAS: gastos
-- que el usuario sube y la IA lee. Esto es lo contrario, y necesita entidades
-- propias: un cliente no es un proveedor, y una factura emitida tiene valor
-- probatorio que una recibida no tiene.
--
-- Diseño (mismo criterio que ADR-002, el motor de pagos): el cliente puede
-- LEER estas tablas pero nunca escribirlas. Toda emisión pasa por una función
-- que, en una sola transacción:
--   1. reserva el número de la serie sin dejar huecos,
--   2. revalida que los importes cuadran,
--   3. escribe la factura y sus líneas,
--   4. añade el registro de facturación encadenado.
--
-- El encadenado SHA-256 de `bill_records` no es decoración: es la estructura
-- que exige el RD 1007/2023 para los Sistemas Informáticos de Facturación, y
-- construirla ahora evita rehacer el modelo cuando toque enviar a la AEAT.
--
-- Prefijo `bill_`: esta base de datos es compartida con otras aplicaciones.
-- ============================================================

-- ── Clientes ───────────────────────────────────────────────────
create table if not exists public.bill_customers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null check (length(trim(name)) between 1 and 140),
  tax_id          text,
  country         text not null check (length(country) = 2),
  kind            text not null default 'business' check (kind in ('business', 'individual')),
  email           text,
  address         text,
  -- Días desde la emisión hasta el vencimiento; 0 = al contado.
  payment_terms_days integer not null default 30 check (payment_terms_days between 0 and 365),
  -- NIF-IVA comprobado en VIES: sin esto no hay inversión del sujeto pasivo.
  vat_validated   boolean not null default false,
  vat_validated_at timestamptz,
  equivalence_surcharge boolean not null default false,
  language        text not null default 'es' check (language in ('es', 'de', 'en')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists bill_customers_user_idx on public.bill_customers (user_id, name);

-- ── Series de numeración ───────────────────────────────────────
-- La numeración correlativa sin huecos es obligatoria, así que vive en la base
-- de datos con bloqueo de fila: dos facturas emitidas a la vez no pueden
-- llevarse el mismo número ni saltarse uno.
create table if not exists public.bill_series (
  user_id     uuid not null references auth.users(id) on delete cascade,
  series      text not null check (series ~ '^[A-Z0-9-]{1,10}$'),
  year        integer not null check (year between 2000 and 2999),
  last_number integer not null default 0 check (last_number >= 0),
  primary key (user_id, series, year)
);

-- ── Facturas emitidas ──────────────────────────────────────────
create table if not exists public.bill_invoices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  customer_id   uuid not null references public.bill_customers(id) on delete restrict,

  series        text not null,
  year          integer not null,
  number        integer not null check (number > 0),
  -- Lo que se imprime: "FA-2026/0001".
  reference     text not null,

  issue_date    date not null,
  due_date      date not null,
  currency      text not null check (currency in ('EUR', 'CHF')),

  tax_case      text not null check (tax_case in
                  ('domestic', 'eu_reverse_charge', 'eu_consumer', 'export', 'domestic_exempt')),
  vat_rate        numeric(5,4) not null default 0 check (vat_rate >= 0 and vat_rate < 1),
  retention_rate  numeric(5,4) not null default 0 check (retention_rate >= 0 and retention_rate < 1),
  equivalence_rate numeric(5,4) not null default 0 check (equivalence_rate >= 0 and equivalence_rate < 1),

  net_cents         bigint not null check (net_cents > 0),
  vat_cents         bigint not null default 0 check (vat_cents >= 0),
  equivalence_cents bigint not null default 0 check (equivalence_cents >= 0),
  retention_cents   bigint not null default 0 check (retention_cents >= 0),
  total_cents       bigint not null check (total_cents > 0),

  legal_mentions text[] not null default '{}',
  notes          text,

  status        text not null default 'issued'
                  check (status in ('issued', 'paid', 'cancelled')),
  paid_at       timestamptz,
  -- Una factura emitida no se corrige: se rectifica con otra.
  rectifies_id  uuid references public.bill_invoices(id),

  created_at    timestamptz not null default now(),

  unique (user_id, series, year, number),
  -- La aritmética que se imprime tiene que cuadrar con la que se guarda.
  constraint bill_invoices_total_matches check (
    total_cents = net_cents + vat_cents + equivalence_cents - retention_cents
  )
);

create index if not exists bill_invoices_user_idx on public.bill_invoices (user_id, issue_date desc);
create index if not exists bill_invoices_customer_idx on public.bill_invoices (customer_id);

-- ── Líneas ─────────────────────────────────────────────────────
create table if not exists public.bill_invoice_lines (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references public.bill_invoices(id) on delete cascade,
  position      integer not null check (position > 0),
  description   text not null check (length(trim(description)) between 1 and 500),
  -- Milésimas: 12,5 horas = 12500. Permite fracciones sin coma flotante.
  quantity_milli bigint not null check (quantity_milli > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  discount_rate numeric(5,4) not null default 0 check (discount_rate >= 0 and discount_rate < 1),
  net_cents     bigint not null check (net_cents >= 0),
  unique (invoice_id, position)
);

-- ── Registro de facturación, encadenado e inmutable ────────────
create table if not exists public.bill_records (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  invoice_id    uuid not null references public.bill_invoices(id) on delete cascade,
  -- Huella del registro anterior de este mismo usuario: alterar uno rompe
  -- la cadena y se nota.
  previous_hash text,
  hash          text not null,
  payload       jsonb not null,
  recorded_at   timestamptz not null default now()
);

create index if not exists bill_records_user_idx on public.bill_records (user_id, id desc);

create or replace function public.bill_records_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'bill_records is append-only (% rejected)', tg_op;
end $$;

drop trigger if exists bill_records_no_update on public.bill_records;
create trigger bill_records_no_update
  before update or delete on public.bill_records
  for each row execute function public.bill_records_immutable();

-- ── RLS: leer lo propio, escribir solo por función ─────────────
alter table public.bill_customers     enable row level security;
alter table public.bill_series        enable row level security;
alter table public.bill_invoices      enable row level security;
alter table public.bill_invoice_lines enable row level security;
alter table public.bill_records       enable row level security;

drop policy if exists "bill_customers: owner reads" on public.bill_customers;
create policy "bill_customers: owner reads" on public.bill_customers
  for select to authenticated using ((select auth.uid()) = user_id);

-- Los clientes sí se gestionan directamente: no tienen valor probatorio.
drop policy if exists "bill_customers: owner writes" on public.bill_customers;
create policy "bill_customers: owner writes" on public.bill_customers
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "bill_invoices: owner reads" on public.bill_invoices;
create policy "bill_invoices: owner reads" on public.bill_invoices
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "bill_lines: owner reads" on public.bill_invoice_lines;
create policy "bill_lines: owner reads" on public.bill_invoice_lines
  for select to authenticated using (
    exists (select 1 from public.bill_invoices i
            where i.id = invoice_id and i.user_id = (select auth.uid()))
  );

drop policy if exists "bill_series: owner reads" on public.bill_series;
create policy "bill_series: owner reads" on public.bill_series
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "bill_records: owner reads" on public.bill_records;
create policy "bill_records: owner reads" on public.bill_records
  for select to authenticated using ((select auth.uid()) = user_id);

-- ── Emisión ────────────────────────────────────────────────────
create or replace function public.bill_require_user()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;
  return uid;
end $$;

/**
 * Emite una factura: reserva número, revalida importes, escribe factura,
 * líneas y registro encadenado. Todo o nada.
 *
 * Los importes los calcula la aplicación (código probado), pero aquí se
 * vuelven a comprobar: una factura cuyo total no cuadre con sus partes no
 * entra en la base de datos aunque el cliente insista.
 */
create or replace function public.bill_issue_invoice(
  p_customer_id uuid,
  p_series text,
  p_issue_date date,
  p_currency text,
  p_tax jsonb,        -- {case, vatRate, retentionRate, equivalenceRate, legalMentions}
  p_amounts jsonb,    -- {netCents, vatCents, equivalenceCents, retentionCents, totalCents}
  p_lines jsonb,      -- [{description, quantityMilli, unitPriceCents, discountRate, netCents}]
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid        uuid := public.bill_require_user();
  v_cust     public.bill_customers;
  v_year     integer := extract(year from p_issue_date);
  v_number   integer;
  v_ref      text;
  v_id       uuid;
  v_line     jsonb;
  v_pos      integer := 0;
  v_net      bigint := (p_amounts->>'netCents')::bigint;
  v_vat      bigint := coalesce((p_amounts->>'vatCents')::bigint, 0);
  v_equiv    bigint := coalesce((p_amounts->>'equivalenceCents')::bigint, 0);
  v_ret      bigint := coalesce((p_amounts->>'retentionCents')::bigint, 0);
  v_total    bigint := (p_amounts->>'totalCents')::bigint;
  v_sum      bigint := 0;
  v_prev     text;
  v_payload  jsonb;
begin
  select * into v_cust from public.bill_customers
   where id = p_customer_id and user_id = uid;
  if not found then
    raise exception 'customer not found' using errcode = 'no_data_found';
  end if;

  if jsonb_array_length(p_lines) = 0 then
    raise exception 'an invoice needs at least one line' using errcode = 'check_violation';
  end if;

  -- Las líneas tienen que sumar la base imponible declarada.
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sum := v_sum + (v_line->>'netCents')::bigint;
  end loop;
  if v_sum <> v_net then
    raise exception 'lines sum % but net is %', v_sum, v_net using errcode = 'check_violation';
  end if;
  if v_total <> v_net + v_vat + v_equiv - v_ret then
    raise exception 'total does not match its parts' using errcode = 'check_violation';
  end if;

  -- Número correlativo, con la fila bloqueada hasta el commit.
  insert into public.bill_series (user_id, series, year, last_number)
  values (uid, p_series, v_year, 0)
  on conflict (user_id, series, year) do nothing;

  update public.bill_series
     set last_number = last_number + 1
   where user_id = uid and series = p_series and year = v_year
  returning last_number into v_number;

  v_ref := p_series || '-' || v_year || '/' || lpad(v_number::text, 4, '0');

  insert into public.bill_invoices (
    user_id, customer_id, series, year, number, reference,
    issue_date, due_date, currency, tax_case,
    vat_rate, retention_rate, equivalence_rate,
    net_cents, vat_cents, equivalence_cents, retention_cents, total_cents,
    legal_mentions, notes
  ) values (
    uid, p_customer_id, p_series, v_year, v_number, v_ref,
    p_issue_date, p_issue_date + (v_cust.payment_terms_days || ' days')::interval,
    p_currency, p_tax->>'case',
    coalesce((p_tax->>'vatRate')::numeric, 0),
    coalesce((p_tax->>'retentionRate')::numeric, 0),
    coalesce((p_tax->>'equivalenceRate')::numeric, 0),
    v_net, v_vat, v_equiv, v_ret, v_total,
    coalesce(array(select jsonb_array_elements_text(p_tax->'legalMentions')), '{}'),
    p_notes
  ) returning id into v_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_pos := v_pos + 1;
    insert into public.bill_invoice_lines (
      invoice_id, position, description, quantity_milli,
      unit_price_cents, discount_rate, net_cents
    ) values (
      v_id, v_pos, v_line->>'description',
      (v_line->>'quantityMilli')::bigint,
      (v_line->>'unitPriceCents')::bigint,
      coalesce((v_line->>'discountRate')::numeric, 0),
      (v_line->>'netCents')::bigint
    );
  end loop;

  -- Registro de facturación encadenado.
  select hash into v_prev from public.bill_records
   where user_id = uid order by id desc limit 1;

  v_payload := jsonb_build_object(
    'reference', v_ref,
    'issueDate', p_issue_date,
    'issuerUser', uid,
    'customerTaxId', v_cust.tax_id,
    'customerName', v_cust.name,
    'currency', p_currency,
    'netCents', v_net,
    'vatCents', v_vat,
    'totalCents', v_total,
    'taxCase', p_tax->>'case'
  );

  insert into public.bill_records (user_id, invoice_id, previous_hash, hash, payload)
  values (
    uid, v_id, v_prev,
    -- sha256() es del núcleo de Postgres; digest() vive en pgcrypto, que en
    -- Supabase está en el esquema `extensions` y no en el search_path de esta
    -- función. Usar el del núcleo evita una dependencia que fallaría en
    -- producción sin avisar en local.
    encode(sha256(convert_to(coalesce(v_prev, '') || v_payload::text, 'UTF8')), 'hex'),
    v_payload
  );

  return v_id;
end $$;

revoke all on function public.bill_issue_invoice(uuid, text, date, text, jsonb, jsonb, jsonb, text) from public;
grant execute on function public.bill_issue_invoice(uuid, text, date, text, jsonb, jsonb, jsonb, text) to authenticated;

/** Marca una factura como cobrada. No toca importes ni numeración. */
create or replace function public.bill_mark_paid(p_invoice_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := public.bill_require_user();
begin
  update public.bill_invoices
     set status = 'paid', paid_at = now()
   where id = p_invoice_id and user_id = uid and status = 'issued';
  if not found then
    raise exception 'invoice not found or not issued' using errcode = 'no_data_found';
  end if;
end $$;

revoke all on function public.bill_mark_paid(uuid) from public;
grant execute on function public.bill_mark_paid(uuid) to authenticated;
