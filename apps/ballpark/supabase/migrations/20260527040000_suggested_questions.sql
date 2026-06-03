-- Crowdsourced question suggestions. Separate from the LLM review queue —
-- these are user submissions that need a human to (a) sanity-check the
-- question, (b) find or estimate an answer, and (c) promote into the live
-- pool. Light schema; we'll iterate as patterns emerge.

create table public.suggested_questions (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  suggested_answer numeric,
  suggested_unit text,
  notes text,
  submitter_name text,
  submitter_room_code text,
  status text not null default 'new' check (status in ('new', 'in_review', 'accepted', 'rejected')),
  ip_hash text,
  created_at timestamptz not null default now()
);

create index suggested_questions_status_idx on public.suggested_questions (status, created_at desc);

alter table public.suggested_questions enable row level security;
-- No anon select/update. Anon only inserts via the Edge route which uses the
-- service role. (Admin reads happen via service role too.)
