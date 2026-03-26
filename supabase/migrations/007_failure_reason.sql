-- Migration 007: add failure_reason to invoices
-- Records why AI analysis failed (e.g. not_invoice, image_unclear, timeout_8s, parsing_failed)
-- Safe to run multiple times (idempotent via IF NOT EXISTS).

alter table public.invoices
  add column if not exists failure_reason text;

comment on column public.invoices.failure_reason is
  'Human-readable code for why AI analysis failed. Set by the pipeline on all error paths. '
  'Known values: not_invoice | image_unclear | timeout_8s | parsing_failed | handwritten_only. '
  'Null when analysis succeeded.';
