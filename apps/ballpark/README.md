# Ballpark

A live guessing game for weird numerical questions. Play solo, 2–6 free-for-all, or in teams.

## Stack

- Next.js 15 (App Router) on Vercel
- Supabase Postgres + Realtime + Anonymous auth
- Tailwind + Motion (framer-motion v11)
- Vitest for `lib/` unit tests

## Local dev

1. Install deps: `pnpm install`
2. Push schema to Supabase: `pnpm db:push` (requires Supabase CLI logged in)
3. Run the app: `pnpm dev` → http://localhost:3000

## Env

See `.env.example`. Local values live in `.env.local`.

## Project layout

```
app/
  page.tsx                landing
  _components/            landing form
  r/[code]/               room (lobby → round → reveal → ended)
  api/                    trusted server routes (service-role)
lib/                      scoring, types, supabase clients, identity
components/               PaperCard, StampButton, ChipStamp, Logo
supabase/migrations/      initial schema + 10 seed questions
```

## Adding questions

For now: insert directly into `public.questions` via SQL or the Supabase dashboard.
The LLM-driven authoring pipeline lands in a later iteration.
