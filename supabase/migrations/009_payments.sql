-- ============================================================
-- Migration: 009_payments
-- Payment decision layer: supplier bank accounts with out-of-band
-- verification and cooling-off, accepted reviews, payment batches
-- (ISO 20022 pain.001) and an append-only audit log.
--
-- Design (ADR-002): the client can READ these tables but never write
-- them. Every change goes through a function below, which
--   1. re-checks the invariant that makes the change safe,
--   2. writes the new state, and
--   3. writes the audit entry
-- in one transaction. A bug in the application can therefore not
-- schedule a payment to an unverified account, pay an invoice twice,
-- or change state without leaving a trace.
--
-- Prefix `pay_`: this database is shared with other applications.
-- ============================================================

-- ── Invoice fields the extraction adds for payment ─────────────
alter table public.invoices add column if not exists payment_iban      text;
alter table public.invoices add column if not exists payment_reference text;

comment on column public.invoices.payment_iban is
  'IBAN printed on the document. Evidence only: payments go to the verified supplier account, never here.';
comment on column public.invoices.payment_reference is
  'Creditor reference printed on the document (Swiss QRR, ISO 11649 SCOR or free text).';

-- ── Helpers ────────────────────────────────────────────────────

-- ISO 13616 check: format + MOD 97-10. numeric is arbitrary precision,
-- so the rearranged 30+ digit number is computed exactly.
create or replace function public.pay_iban_valid(p_iban text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  rearranged text;
  digits text := '';
  ch text;
begin
  if p_iban is null or p_iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{8,30}$' then
    return false;
  end if;
  rearranged := substr(p_iban, 5) || substr(p_iban, 1, 4);
  foreach ch in array regexp_split_to_array(rearranged, '') loop
    if ch ~ '[A-Z]' then
      digits := digits || (ascii(ch) - 55)::text;
    else
      digits := digits || ch;
    end if;
  end loop;
  return (digits::numeric % 97) = 1;
end;
$$;

-- "ES91 •••• 1332": what the audit log stores instead of full IBANs.
create or replace function public.pay_mask_iban(p_iban text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when length(p_iban) <= 8 then p_iban
              else substr(p_iban, 1, 4) || ' •••• ' || right(p_iban, 4) end
$$;

-- ── Settings ───────────────────────────────────────────────────
create table public.pay_settings (
  user_id                uuid        primary key references public.profiles(id) on delete cascade,
  debtor_name            text        not null check (length(trim(debtor_name)) between 1 and 70),
  debtor_iban            text        not null check (public.pay_iban_valid(debtor_iban)),
  debtor_bic             text        check (debtor_bic is null or debtor_bic ~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$'),
  review_threshold_cents bigint      not null default 1000000 check (review_threshold_cents > 0),
  cooling_off_hours      integer     not null default 72 check (cooling_off_hours between 0 and 720),
  updated_at             timestamptz not null default now()
);

comment on table public.pay_settings is 'Payer account and payment controls, one row per user.';

-- ── Supplier bank accounts ─────────────────────────────────────
create table public.pay_supplier_accounts (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references public.profiles(id) on delete cascade,
  supplier_key          text        not null check (supplier_key ~ '^(tax|name):.+$'),
  supplier_name         text        not null check (length(trim(supplier_name)) between 1 and 140),
  iban                  text        not null check (public.pay_iban_valid(iban)),
  status                text        not null default 'pending_verification'
                        check (status in ('pending_verification', 'verified', 'rejected', 'superseded')),
  is_change             boolean     not null default false,
  source                text        not null check (source in ('manual', 'invoice')),
  source_invoice_id     uuid        references public.invoices(id) on delete set null,
  registered_at         timestamptz not null default now(),
  verified_at           timestamptz,
  verification_channel  text        check (verification_channel in
                          ('phone_callback', 'in_person', 'signed_letter', 'bank_confirmation')),
  verification_contact  text,
  verification_note     text,
  cooling_off_until     timestamptz,
  closed_at             timestamptz,
  rejection_reason      text,
  -- A verified account always says how, and through which known contact.
  constraint pay_accounts_verified_has_evidence check (
    status <> 'verified'
    or (verified_at is not null and verification_channel is not null
        and length(trim(coalesce(verification_contact, ''))) > 0)
  )
);

comment on table public.pay_supplier_accounts is
  'Where each supplier is paid. New or changed IBANs start unverified; a change also waits a cooling-off period after verification.';

-- One live account per supplier: registering a new IBAN supersedes the old one.
create unique index pay_accounts_one_live_per_supplier
  on public.pay_supplier_accounts (user_id, supplier_key)
  where status in ('pending_verification', 'verified');
create index pay_accounts_user_idx on public.pay_supplier_accounts (user_id, status);
create index pay_accounts_source_invoice_idx on public.pay_supplier_accounts (source_invoice_id);

-- ── Accepted reviews ───────────────────────────────────────────
create table public.pay_overrides (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  invoice_id  uuid        not null references public.invoices(id) on delete cascade,
  fingerprint text        not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  note        text        not null check (length(trim(note)) between 3 and 500),
  created_at  timestamptz not null default now()
);

comment on table public.pay_overrides is
  'A person accepted the review reasons of one exact evaluation (fingerprint). Any change in amount, account or reasons voids it.';

create index pay_overrides_invoice_idx on public.pay_overrides (user_id, invoice_id, created_at desc);

-- ── Batches and payments ───────────────────────────────────────
create table public.pay_batches (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references public.profiles(id) on delete cascade,
  message_id        text        not null check (message_id ~ '^[A-Za-z0-9-]{1,35}$'),
  status            text        not null default 'generated'
                    check (status in ('generated', 'executed', 'cancelled')),
  tx_count          integer     not null check (tx_count > 0),
  control_sum_cents bigint      not null check (control_sum_cents > 0),
  currencies        text[]      not null,
  xml               text        not null,
  created_at        timestamptz not null default now(),
  executed_at       timestamptz,
  cancelled_at      timestamptz,
  cancel_reason     text,
  unique (user_id, message_id)
);

comment on table public.pay_batches is
  'A pain.001.001.09 file generated for upload to e-banking. Generating it moves no money.';

create table public.pay_payments (
  id                       uuid        primary key default gen_random_uuid(),
  user_id                  uuid        not null references public.profiles(id) on delete cascade,
  batch_id                 uuid        not null references public.pay_batches(id) on delete cascade,
  -- NO ACTION (default): an invoice with payments cannot be deleted on its own.
  invoice_id               uuid        not null references public.invoices(id),
  account_id               uuid        not null references public.pay_supplier_accounts(id),
  amount_cents             bigint      not null check (amount_cents > 0),
  currency                 text        not null check (currency in ('EUR', 'CHF')),
  end_to_end_id            text        not null,
  requested_execution_date date        not null,
  status                   text        not null default 'in_batch'
                           check (status in ('in_batch', 'paid', 'cancelled')),
  created_at               timestamptz not null default now()
);

-- The database-level guarantee against paying an invoice twice.
create unique index pay_payments_one_open_per_invoice
  on public.pay_payments (invoice_id)
  where status in ('in_batch', 'paid');
create index pay_payments_batch_idx on public.pay_payments (batch_id);
create index pay_payments_user_idx on public.pay_payments (user_id, status);
create index pay_payments_account_idx on public.pay_payments (account_id);

-- ── Audit log (append-only) ────────────────────────────────────
-- No foreign key on user_id on purpose: accounting records must outlive
-- the user account (Swiss CO art. 958f: 10 years). See ADR-002.
create table public.pay_audit_log (
  id          bigint      generated always as identity primary key,
  user_id     uuid        not null,
  occurred_at timestamptz not null default now(),
  action      text        not null,
  entity_type text        not null,
  entity_id   uuid,
  details     jsonb       not null default '{}'::jsonb
);

comment on table public.pay_audit_log is
  'Append-only record of every payment decision and state change. UPDATE, DELETE and TRUNCATE are rejected by trigger.';

create index pay_audit_user_idx on public.pay_audit_log (user_id, occurred_at desc);
create index pay_audit_entity_idx on public.pay_audit_log (entity_id);

create or replace function public.pay_audit_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'pay_audit_log is append-only (% rejected)', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger pay_audit_no_update_delete
  before update or delete on public.pay_audit_log
  for each row execute function public.pay_audit_immutable();

create trigger pay_audit_no_truncate
  before truncate on public.pay_audit_log
  for each statement execute function public.pay_audit_immutable();

create or replace function public.pay_audit(
  p_user uuid, p_action text, p_entity_type text, p_entity_id uuid, p_details jsonb
) returns void
language sql
set search_path = ''
as $$
  insert into public.pay_audit_log (user_id, action, entity_type, entity_id, details)
  values (p_user, p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- ── Row Level Security: read own rows, write only through functions ─
alter table public.pay_settings          enable row level security;
alter table public.pay_supplier_accounts enable row level security;
alter table public.pay_overrides         enable row level security;
alter table public.pay_batches           enable row level security;
alter table public.pay_payments          enable row level security;
alter table public.pay_audit_log         enable row level security;

create policy "pay_settings: owner reads"   on public.pay_settings          for select to authenticated using ((select auth.uid()) = user_id);
create policy "pay_accounts: owner reads"   on public.pay_supplier_accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy "pay_overrides: owner reads"  on public.pay_overrides         for select to authenticated using ((select auth.uid()) = user_id);
create policy "pay_batches: owner reads"    on public.pay_batches           for select to authenticated using ((select auth.uid()) = user_id);
create policy "pay_payments: owner reads"   on public.pay_payments          for select to authenticated using ((select auth.uid()) = user_id);
create policy "pay_audit: owner reads"      on public.pay_audit_log         for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.pay_settings, public.pay_supplier_accounts, public.pay_overrides,
              public.pay_batches, public.pay_payments, public.pay_audit_log
  from anon, authenticated;
grant select on public.pay_settings, public.pay_supplier_accounts, public.pay_overrides,
                public.pay_batches, public.pay_payments, public.pay_audit_log
  to authenticated;

-- ── Commands ───────────────────────────────────────────────────
-- SECURITY DEFINER with an empty search_path: every object is schema-
-- qualified, and the caller is always auth.uid(), never a parameter.

create or replace function public.pay_require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;
  return uid;
end;
$$;

-- Settings ------------------------------------------------------
create or replace function public.pay_save_settings(
  p_debtor_name text, p_debtor_iban text, p_debtor_bic text,
  p_review_threshold_cents bigint, p_cooling_off_hours integer
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.pay_require_user();
  before_row public.pay_settings;
begin
  select * into before_row from public.pay_settings where user_id = uid;

  insert into public.pay_settings as s
    (user_id, debtor_name, debtor_iban, debtor_bic, review_threshold_cents, cooling_off_hours, updated_at)
  values (uid, trim(p_debtor_name), p_debtor_iban, nullif(p_debtor_bic, ''),
          p_review_threshold_cents, p_cooling_off_hours, now())
  on conflict (user_id) do update set
    debtor_name = excluded.debtor_name,
    debtor_iban = excluded.debtor_iban,
    debtor_bic = excluded.debtor_bic,
    review_threshold_cents = excluded.review_threshold_cents,
    cooling_off_hours = excluded.cooling_off_hours,
    updated_at = now();

  perform public.pay_audit(uid, 'settings_saved', 'settings', null, jsonb_build_object(
    'debtor_iban', public.pay_mask_iban(p_debtor_iban),
    'review_threshold_cents', p_review_threshold_cents,
    'cooling_off_hours', p_cooling_off_hours,
    'previous_review_threshold_cents', before_row.review_threshold_cents,
    'previous_cooling_off_hours', before_row.cooling_off_hours
  ));
end;
$$;

-- Accounts ------------------------------------------------------
create or replace function public.pay_register_account(
  p_supplier_key text, p_supplier_name text, p_iban text,
  p_source text, p_source_invoice_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.pay_require_user();
  live public.pay_supplier_accounts;
  had_live boolean;
  new_id uuid;
begin
  if not public.pay_iban_valid(p_iban) then
    raise exception 'invalid IBAN' using errcode = 'check_violation';
  end if;
  if p_source_invoice_id is not null and not exists (
    select 1 from public.invoices where id = p_source_invoice_id and user_id = uid
  ) then
    raise exception 'invoice not found' using errcode = 'no_data_found';
  end if;

  select * into live from public.pay_supplier_accounts
  where user_id = uid and supplier_key = p_supplier_key
    and status in ('pending_verification', 'verified')
  for update;
  -- Captured now: FOUND is overwritten by every later statement.
  had_live := found;

  -- Same IBAN already live: nothing to do (idempotent).
  if had_live and live.iban = p_iban then
    return live.id;
  end if;

  if had_live then
    update public.pay_supplier_accounts
      set status = 'superseded', closed_at = now()
      where id = live.id;
  end if;

  insert into public.pay_supplier_accounts
    (user_id, supplier_key, supplier_name, iban, is_change, source, source_invoice_id)
  values (uid, p_supplier_key, trim(p_supplier_name), p_iban, had_live, p_source, p_source_invoice_id)
  returning id into new_id;

  perform public.pay_audit(uid, case when had_live then 'account_changed' else 'account_registered' end,
    'supplier_account', new_id, jsonb_build_object(
      'supplier_key', p_supplier_key,
      'iban', public.pay_mask_iban(p_iban),
      'previous_iban', case when had_live then public.pay_mask_iban(live.iban) end,
      'previous_account_id', live.id,
      'source', p_source,
      'source_invoice_id', p_source_invoice_id
    ));
  return new_id;
end;
$$;

create or replace function public.pay_verify_account(
  p_account_id uuid, p_channel text, p_contact text, p_note text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.pay_require_user();
  acc public.pay_supplier_accounts;
  v_hours integer;
  until timestamptz;
begin
  select * into acc from public.pay_supplier_accounts
  where id = p_account_id and user_id = uid for update;
  if not found then
    raise exception 'account not found' using errcode = 'no_data_found';
  end if;
  if acc.status <> 'pending_verification' then
    raise exception 'account is %, not pending verification', acc.status using errcode = 'check_violation';
  end if;
  if length(trim(coalesce(p_contact, ''))) = 0 then
    raise exception 'verification needs the known contact used' using errcode = 'check_violation';
  end if;

  select coalesce((select cooling_off_hours from public.pay_settings where user_id = uid), 72) into v_hours;
  until := case when acc.is_change and v_hours > 0 then now() + make_interval(hours => v_hours) end;

  update public.pay_supplier_accounts set
    status = 'verified', verified_at = now(), verification_channel = p_channel,
    verification_contact = trim(p_contact), verification_note = nullif(trim(p_note), ''),
    cooling_off_until = until
  where id = acc.id;

  perform public.pay_audit(uid, 'account_verified', 'supplier_account', acc.id, jsonb_build_object(
    'iban', public.pay_mask_iban(acc.iban), 'channel', p_channel,
    'is_change', acc.is_change, 'cooling_off_until', until
  ));
end;
$$;

create or replace function public.pay_reject_account(p_account_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.pay_require_user();
  acc public.pay_supplier_accounts;
begin
  select * into acc from public.pay_supplier_accounts
  where id = p_account_id and user_id = uid for update;
  if not found then
    raise exception 'account not found' using errcode = 'no_data_found';
  end if;
  if acc.status not in ('pending_verification', 'verified') then
    raise exception 'account is already %', acc.status using errcode = 'check_violation';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'a rejection needs a reason' using errcode = 'check_violation';
  end if;
  -- Money already scheduled to this account must be cancelled first.
  if exists (select 1 from public.pay_payments where account_id = acc.id and status = 'in_batch') then
    raise exception 'account has payments in an open batch; cancel the batch first' using errcode = 'check_violation';
  end if;

  update public.pay_supplier_accounts set
    status = 'rejected', closed_at = now(), rejection_reason = trim(p_reason)
  where id = acc.id;

  perform public.pay_audit(uid, 'account_rejected', 'supplier_account', acc.id, jsonb_build_object(
    'iban', public.pay_mask_iban(acc.iban), 'reason', trim(p_reason)
  ));
end;
$$;

-- Reviews -------------------------------------------------------
create or replace function public.pay_accept_review(
  p_invoice_id uuid, p_fingerprint text, p_note text, p_reasons jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.pay_require_user();
  new_id uuid;
begin
  if not exists (select 1 from public.invoices where id = p_invoice_id and user_id = uid) then
    raise exception 'invoice not found' using errcode = 'no_data_found';
  end if;

  insert into public.pay_overrides (user_id, invoice_id, fingerprint, note)
  values (uid, p_invoice_id, p_fingerprint, trim(p_note))
  returning id into new_id;

  perform public.pay_audit(uid, 'review_accepted', 'invoice', p_invoice_id, jsonb_build_object(
    'override_id', new_id, 'fingerprint', p_fingerprint, 'note', trim(p_note), 'reasons', p_reasons
  ));
end;
$$;

-- Batches -------------------------------------------------------
-- p_items: [{invoice_id, account_id, amount_cents, currency, end_to_end_id,
--            requested_execution_date}]
-- The application decided; the database re-checks what must never be wrong.
create or replace function public.pay_create_batch(
  p_message_id text, p_xml text, p_items jsonb, p_decisions jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.pay_require_user();
  batch_id uuid;
  item jsonb;
  inv public.invoices;
  acc public.pay_supplier_accounts;
  total bigint := 0;
  n integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'a batch needs at least one payment' using errcode = 'check_violation';
  end if;

  insert into public.pay_batches (user_id, message_id, tx_count, control_sum_cents, currencies, xml)
  values (uid, p_message_id, 1, 1, '{}', p_xml)
  returning id into batch_id;

  for item in select * from jsonb_array_elements(p_items) loop
    select * into inv from public.invoices
    where id = (item->>'invoice_id')::uuid and user_id = uid
    for update;
    if not found then
      raise exception 'invoice % not found', item->>'invoice_id' using errcode = 'no_data_found';
    end if;
    if inv.status <> 'approved' then
      raise exception 'invoice % is not approved', inv.id using errcode = 'check_violation';
    end if;
    if inv.total_cents is distinct from (item->>'amount_cents')::bigint then
      raise exception 'amount for invoice % does not match the invoice', inv.id using errcode = 'check_violation';
    end if;
    if inv.currency is distinct from item->>'currency' then
      raise exception 'currency for invoice % does not match the invoice', inv.id using errcode = 'check_violation';
    end if;

    select * into acc from public.pay_supplier_accounts
    where id = (item->>'account_id')::uuid and user_id = uid;
    if not found or acc.status <> 'verified' then
      raise exception 'account for invoice % is not verified', inv.id using errcode = 'check_violation';
    end if;
    if acc.cooling_off_until is not null and acc.cooling_off_until > now() then
      raise exception 'account for invoice % is in cooling-off until %', inv.id, acc.cooling_off_until
        using errcode = 'check_violation';
    end if;

    -- A second open payment for the same invoice violates
    -- pay_payments_one_open_per_invoice and aborts the whole batch.
    insert into public.pay_payments
      (user_id, batch_id, invoice_id, account_id, amount_cents, currency, end_to_end_id, requested_execution_date)
    values (uid, batch_id, inv.id, acc.id, inv.total_cents, inv.currency,
            item->>'end_to_end_id', (item->>'requested_execution_date')::date);

    total := total + inv.total_cents;
    n := n + 1;
  end loop;

  update public.pay_batches set
    tx_count = n,
    control_sum_cents = total,
    currencies = (select array_agg(distinct e->>'currency' order by e->>'currency')
                  from jsonb_array_elements(p_items) e)
  where id = batch_id;

  perform public.pay_audit(uid, 'batch_created', 'batch', batch_id, jsonb_build_object(
    'message_id', p_message_id, 'tx_count', n, 'control_sum_cents', total, 'decisions', p_decisions
  ));
  return batch_id;
end;
$$;

create or replace function public.pay_mark_batch_executed(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.pay_require_user();
  b public.pay_batches;
begin
  select * into b from public.pay_batches where id = p_batch_id and user_id = uid for update;
  if not found then
    raise exception 'batch not found' using errcode = 'no_data_found';
  end if;
  if b.status <> 'generated' then
    raise exception 'batch is already %', b.status using errcode = 'check_violation';
  end if;

  update public.pay_batches set status = 'executed', executed_at = now() where id = b.id;
  update public.pay_payments set status = 'paid' where batch_id = b.id and status = 'in_batch';

  perform public.pay_audit(uid, 'batch_executed', 'batch', b.id, jsonb_build_object(
    'message_id', b.message_id, 'tx_count', b.tx_count, 'control_sum_cents', b.control_sum_cents
  ));
end;
$$;

create or replace function public.pay_cancel_batch(p_batch_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.pay_require_user();
  b public.pay_batches;
begin
  select * into b from public.pay_batches where id = p_batch_id and user_id = uid for update;
  if not found then
    raise exception 'batch not found' using errcode = 'no_data_found';
  end if;
  if b.status <> 'generated' then
    raise exception 'only a generated batch can be cancelled (this one is %)', b.status
      using errcode = 'check_violation';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'a cancellation needs a reason' using errcode = 'check_violation';
  end if;

  update public.pay_batches set status = 'cancelled', cancelled_at = now(), cancel_reason = trim(p_reason)
  where id = b.id;
  update public.pay_payments set status = 'cancelled' where batch_id = b.id;

  perform public.pay_audit(uid, 'batch_cancelled', 'batch', b.id, jsonb_build_object(
    'message_id', b.message_id, 'reason', trim(p_reason)
  ));
end;
$$;

-- ── Function privileges ─────────────────────────────────────────
revoke all on function
  public.pay_save_settings(text, text, text, bigint, integer),
  public.pay_register_account(text, text, text, text, uuid),
  public.pay_verify_account(uuid, text, text, text),
  public.pay_reject_account(uuid, text),
  public.pay_accept_review(uuid, text, text, jsonb),
  public.pay_create_batch(text, text, jsonb, jsonb),
  public.pay_mark_batch_executed(uuid),
  public.pay_cancel_batch(uuid, text),
  public.pay_audit(uuid, text, text, uuid, jsonb),
  public.pay_require_user(),
  public.pay_audit_immutable()
from public, anon, authenticated;

grant execute on function
  public.pay_save_settings(text, text, text, bigint, integer),
  public.pay_register_account(text, text, text, text, uuid),
  public.pay_verify_account(uuid, text, text, text),
  public.pay_reject_account(uuid, text),
  public.pay_accept_review(uuid, text, text, jsonb),
  public.pay_create_batch(text, text, jsonb, jsonb),
  public.pay_mark_batch_executed(uuid),
  public.pay_cancel_batch(uuid, text)
to authenticated;
