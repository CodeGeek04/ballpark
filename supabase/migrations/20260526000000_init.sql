-- Ballpark: initial schema, RLS, and 10 seed questions.

create extension if not exists "pgcrypto";

-- ── Tables ────────────────────────────────────────────────────────────────────

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  answer numeric not null check (answer > 0),
  unit text,
  category text,
  source_url text,
  k numeric not null default 1.5,
  created_at timestamptz not null default now()
);

create table public.questions_review (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  answer numeric not null,
  unit text,
  category text,
  source_url text,
  model text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  mode text not null check (mode in ('solo','ffa','teams')),
  round_count int not null default 5,
  round_seconds int not null default 60,
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
  team text check (team in ('A','B')),
  is_host boolean not null default false,
  joined_at timestamptz not null default now()
);

create index players_room_idx on public.players (room_id);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  index int not null,
  question_id uuid not null references public.questions(id),
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  revealed_at timestamptz,
  unique (room_id, index)
);

create index rounds_room_idx on public.rounds (room_id);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  team text check (team in ('A','B')),
  guess numeric not null,
  submitted_at timestamptz not null default now(),
  score int,
  unique (round_id, player_id)
);

create index submissions_round_idx on public.submissions (round_id);

-- ── Realtime ──────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.rounds;
alter publication supabase_realtime add table public.submissions;

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- v1 model: clients use the anon key; writes are funneled through Edge Functions
-- (service role). Anon can read all non-sensitive game data. The question
-- `answer` is exposed via the rounds.question_id join only after reveal — for
-- v1 we accept that a determined player could read answers from the questions
-- table; harden in v2 by moving question fetch behind an Edge Function.

alter table public.questions enable row level security;
alter table public.questions_review enable row level security;
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.rounds enable row level security;
alter table public.submissions enable row level security;

create policy "read questions" on public.questions for select using (true);
create policy "read rooms" on public.rooms for select using (true);
create policy "read players" on public.players for select using (true);
create policy "read rounds" on public.rounds for select using (true);
create policy "read submissions" on public.submissions for select using (true);
-- questions_review: no anon access; only service role (which bypasses RLS).

-- ── Seed (10 starter questions) ──────────────────────────────────────────────

insert into public.questions (prompt, answer, unit, category, source_url) values
('How many bananas does the average human eat in a lifetime?', 4820, 'bananas', 'Human Behavior', null),
('How many cups of coffee are consumed worldwide each day?', 2250000000, 'cups', 'Industry & Trade', null),
('How many heartbeats does a blue whale have in a single year?', 5256000, 'beats', 'Biology', null),
('How many breaths does a person take in an average day?', 22000, 'breaths', 'Human Behavior', null),
('How many text messages are sent globally every minute?', 16000000, 'messages', 'Industry & Trade', null),
('How many grains of sand are on a typical 1-mile beach?', 800000000000, 'grains', 'Weird Science', null),
('How many kilometers does a New York City taxi drive in its lifetime?', 480000, 'kilometers', 'Industry & Trade', null),
('How many liters of saliva does a person produce in a lifetime?', 28000, 'liters', 'Biology', null),
('How many lego bricks are produced every second?', 1140, 'bricks', 'Industry & Trade', null),
('How many words does the average person speak per day?', 16000, 'words', 'Human Behavior', null);
