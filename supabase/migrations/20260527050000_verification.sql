-- Sanity-check pass via a second LLM (Haiku). Records an independent estimate
-- and a verdict on whether the stored answer looks plausible.
alter table public.questions add column if not exists verify_status text default 'unverified'
  check (verify_status in ('unverified', 'ok', 'flagged'));
alter table public.questions add column if not exists verify_note text;
alter table public.questions add column if not exists verify_estimate numeric;
alter table public.questions add column if not exists verify_ratio numeric;
alter table public.questions add column if not exists verified_at timestamptz;

create index if not exists questions_verify_status_idx on public.questions (verify_status);
