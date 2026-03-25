-- ============================================================
-- Migration: 004_invoices_bucket
-- Creates the `invoices` storage bucket and its RLS policies.
-- Folder structure: invoices/{user_id}/{uuid}.{ext}
-- ============================================================

-- Create bucket (idempotent)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoices',
  'invoices',
  false,                       -- Private — URLs require signed tokens
  10485760,                    -- 10 MB per file
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
on conflict (id) do nothing;

-- ── Storage RLS policies ──────────────────────────────────────
-- Users may only access objects inside their own subfolder:
--   storage.foldername(name)[1]  →  first path segment = user_id

create policy "invoices: owner upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "invoices: owner read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "invoices: owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "invoices: owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
