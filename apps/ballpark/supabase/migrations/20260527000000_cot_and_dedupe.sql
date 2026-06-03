-- Add chain-of-thought hint storage + enable fuzzy text matching for dedupe.

create extension if not exists pg_trgm;

alter table public.questions add column if not exists cot_hint text;
alter table public.questions_review add column if not exists cot_hint text;

-- Trigram index speeds up similarity lookups during dedupe.
create index if not exists questions_prompt_trgm_idx
  on public.questions using gin (prompt gin_trgm_ops);

create index if not exists questions_review_prompt_trgm_idx
  on public.questions_review using gin (prompt gin_trgm_ops);
