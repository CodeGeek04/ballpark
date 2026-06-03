-- Toppl: initial schema. Independent of Ballpark; one Supabase project per
-- game per the agreed monorepo plan (no content or user sharing between
-- games, just a common developer).

create extension if not exists "pgcrypto";
create extension if not exists pg_trgm;

-- ── Tables ────────────────────────────────────────────────────────────────────

-- Items are the building blocks. Each round picks two items with a
-- meaningful value gap and asks the player which is bigger.
create table public.items (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  value numeric not null check (value > 0),
  unit text not null,
  category text,
  source_url text,
  created_at timestamptz not null default now()
);

create index items_value_idx on public.items (value);
create index items_prompt_trgm_idx on public.items using gin (prompt gin_trgm_ops);

-- Items review queue (LLM-generated, awaits approval). Auto-promoted by a
-- trigger like Ballpark.
create table public.items_review (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  value numeric not null,
  unit text not null,
  category text,
  source_url text,
  model text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  mode text not null check (mode in ('solo','multi')),
  round_count int not null default 7,
  round_seconds int not null default 25,
  status text not null default 'lobby' check (status in ('lobby','playing','revealing','ended')),
  current_round int not null default 0,
  host_player_id uuid,
  created_at timestamptz not null default now()
);

create index rooms_code_idx on public.rooms (code);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  avatar text not null,
  is_host boolean not null default false,
  best_streak int not null default 0,
  current_streak int not null default 0,
  total_correct int not null default 0,
  joined_at timestamptz not null default now()
);

create index players_room_idx on public.players (room_id);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  index int not null,
  item_a_id uuid not null references public.items(id),
  item_b_id uuid not null references public.items(id),
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  revealed_at timestamptz,
  unique (room_id, index)
);

create index rounds_room_idx on public.rounds (room_id);

create table public.picks (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  picked_item_id uuid not null references public.items(id),
  is_correct boolean,
  picked_at timestamptz not null default now(),
  unique (round_id, player_id)
);

create index picks_round_idx on public.picks (round_id);

-- Persistent identity log keyed by hashed IP (mirrors Ballpark pattern).
create table public.player_identities (
  ip_hash text primary key,
  name text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  visit_count int not null default 1
);

-- Feedback + suggested items so we can crowdsource content additions.
create table public.suggested_items (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  suggested_value numeric,
  suggested_unit text,
  notes text,
  submitter_name text,
  status text not null default 'new' check (status in ('new','in_review','accepted','rejected')),
  ip_hash text,
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  name text,
  context text,
  ip_hash text,
  created_at timestamptz not null default now()
);

-- ── Realtime publication ──────────────────────────────────────────────────────
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.rounds;
alter publication supabase_realtime add table public.picks;

-- Full row payloads on UPDATE/DELETE so postgres_changes carry all the data
-- the client needs to reconcile state.
alter table public.rooms replica identity full;
alter table public.players replica identity full;
alter table public.rounds replica identity full;
alter table public.picks replica identity full;

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Same model as Ballpark: writes funnel through service-role API routes; anon
-- can read anything not sensitive.
alter table public.items enable row level security;
alter table public.items_review enable row level security;
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.rounds enable row level security;
alter table public.picks enable row level security;
alter table public.player_identities enable row level security;
alter table public.suggested_items enable row level security;
alter table public.feedback enable row level security;

create policy "read items" on public.items for select using (true);
create policy "read rooms" on public.rooms for select using (true);
create policy "read players" on public.players for select using (true);
create policy "read rounds" on public.rounds for select using (true);
create policy "read picks" on public.picks for select using (true);

-- ── Auto-promote new review rows into live items (LLM pipeline) ──────────────
create or replace function public.toppl_auto_promote()
returns trigger language plpgsql as $$
begin
  if new.status = 'pending' then
    insert into public.items (prompt, value, unit, category, source_url)
    values (new.prompt, new.value, new.unit, new.category, new.source_url);
    new.status := 'approved';
  end if;
  return new;
end;
$$;

drop trigger if exists toppl_auto_promote_trg on public.items_review;
create trigger toppl_auto_promote_trg
  before insert on public.items_review
  for each row execute function public.toppl_auto_promote();

-- ── Fuzzy dedupe helper (used by LLM gen script) ─────────────────────────────
create or replace function public.toppl_similar_item(p text, threshold real)
returns table(prompt text, similarity real)
language sql stable as $$
  select prompt, similarity(prompt, p) as similarity
  from public.items
  where similarity(prompt, p) > threshold
  union all
  select prompt, similarity(prompt, p) as similarity
  from public.items_review
  where status = 'pending' and similarity(prompt, p) > threshold
  order by similarity desc
  limit 1;
$$;

grant execute on function public.toppl_similar_item(text, real) to anon, authenticated, service_role;

-- ── Atomic create-room RPC ────────────────────────────────────────────────────
create or replace function public.toppl_create_room(
  p_mode text,
  p_name text,
  p_avatar text,
  p_start_round boolean default false
)
returns jsonb
language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  new_room public.rooms;
  new_player public.players;
  new_round public.rounds;
  item_a public.items;
  item_b public.items;
  attempt int := 0;
begin
  loop
    new_code := '';
    for i in 1..4 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.rooms (code, mode)
      values (new_code, p_mode)
      returning * into new_room;
      exit;
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt > 6 then raise exception 'could not allocate code'; end if;
    end;
  end loop;

  insert into public.players (room_id, name, avatar, is_host)
  values (new_room.id, p_name, p_avatar, true)
  returning * into new_player;

  update public.rooms set host_player_id = new_player.id where id = new_room.id
  returning * into new_room;

  if p_start_round then
    select * into item_a from public.items order by random() limit 1;
    -- pick a second item with a meaningful value gap (1.4x to 1000x).
    select i.* into item_b
    from public.items i
    where i.id <> item_a.id
      and (greatest(i.value, item_a.value) / nullif(least(i.value, item_a.value), 0)) between 1.4 and 1000
    order by random()
    limit 1;
    if item_b.id is null then
      raise exception 'not enough items in pool';
    end if;

    insert into public.rounds (room_id, index, item_a_id, item_b_id, deadline_at)
    values (new_room.id, 1, item_a.id, item_b.id, now() + (new_room.round_seconds || ' seconds')::interval)
    returning * into new_round;

    update public.rooms set status = 'playing', current_round = 1 where id = new_room.id
    returning * into new_room;
  end if;

  return jsonb_build_object(
    'room', to_jsonb(new_room),
    'player', to_jsonb(new_player),
    'round', case when new_round.id is not null then to_jsonb(new_round) else null end,
    'item_a', case when item_a.id is not null then to_jsonb(item_a) else null end,
    'item_b', case when item_b.id is not null then to_jsonb(item_b) else null end
  );
end;
$$;

grant execute on function public.toppl_create_room(text, text, text, boolean) to anon, authenticated, service_role;

-- ── Atomic pick-pair RPC (used by start-round route) ─────────────────────────
create or replace function public.toppl_pick_pair(p_room_id uuid)
returns table(item_a jsonb, item_b jsonb)
language plpgsql as $$
declare
  used_ids uuid[];
  a public.items;
  b public.items;
begin
  select array_agg(item_id) into used_ids from (
    select item_a_id as item_id from public.rounds where room_id = p_room_id
    union all
    select item_b_id from public.rounds where room_id = p_room_id
  ) u;
  used_ids := coalesce(used_ids, ARRAY[]::uuid[]);

  select * into a from public.items
  where not (id = any(used_ids))
  order by random() limit 1;
  if a.id is null then
    raise exception 'no unused items in pool';
  end if;

  select i.* into b from public.items i
  where i.id <> a.id
    and not (i.id = any(used_ids))
    and (greatest(i.value, a.value) / nullif(least(i.value, a.value), 0)) between 1.4 and 1000
  order by random()
  limit 1;
  if b.id is null then
    -- relax constraint and try again
    select i.* into b from public.items i
    where i.id <> a.id and not (i.id = any(used_ids))
    order by random() limit 1;
    if b.id is null then
      raise exception 'pool exhausted';
    end if;
  end if;

  return query select to_jsonb(a), to_jsonb(b);
end;
$$;

grant execute on function public.toppl_pick_pair(uuid) to anon, authenticated, service_role;

-- ── Hourly cleanup of stale rooms ────────────────────────────────────────────
create extension if not exists pg_cron;
do $$
begin perform cron.unschedule('toppl-cleanup');
exception when others then null;
end$$;
select cron.schedule(
  'toppl-cleanup',
  '13 * * * *',
  $cmd$
    delete from public.rooms
    where (status <> 'ended' and created_at < now() - interval '12 hours')
       or (status = 'ended'  and created_at < now() - interval '7 days');
  $cmd$
);
