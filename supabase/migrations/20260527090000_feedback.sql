create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  name text,
  email text,
  context text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;
-- service-role only (inserts via API route).
