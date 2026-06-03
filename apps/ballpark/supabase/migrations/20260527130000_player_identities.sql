-- Persistent log of who has played, keyed by hashed IP.
-- One row per IP. On every create/join, we upsert the latest name they
-- used and bump last_seen. Lets you answer "how many unique players have
-- we ever seen", "who comes back", "what's their latest name".

create table public.player_identities (
  ip_hash text primary key,
  name text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  visit_count int not null default 1
);

create index player_identities_last_seen_idx on public.player_identities (last_seen desc);
create index player_identities_name_idx on public.player_identities (name);

alter table public.player_identities enable row level security;
-- service-role only access; client never reads or writes this directly.
