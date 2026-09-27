-- ============================================================
-- Migration: 012_invoice_original_filename
--
-- When extraction fails there is nothing on screen to recognise the document
-- by: vendor, number, date and total are all null, and the row shows as
-- "Proveedor desconocido —  —  —". The upload date was already there
-- (created_at) but was not displayed; the file name was never stored at all,
-- because images are re-encoded to JPEG before upload and the storage key
-- keeps only that generated name.
--
-- Storing the name the user chose makes a failed row identifiable, which is
-- the difference between "something failed" and "the Alpine invoice failed".
-- ============================================================

alter table public.invoices
  add column if not exists original_filename text;

comment on column public.invoices.original_filename is
  'File name as the user uploaded it, before any compression or renaming.';
