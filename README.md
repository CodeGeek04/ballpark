# Doozy

A pack of guessing games. Common brand, common developer, no shared content or users between games.

```
repo/
├── apps/
│   ├── portal/    → doozy.fun (the launcher)
│   ├── ballpark/  → ballpark.doozy.fun (also letsballpark.com)
│   └── toppl/     → toppl.doozy.fun
├── package.json   (workspace root)
├── pnpm-workspace.yaml
└── turbo.json
```

## Local development

Install once at the root:

```bash
pnpm install
```

Run a single app:

```bash
pnpm --filter ballpark dev    # ballpark on :3000
pnpm --filter portal dev      # portal on :3001
pnpm --filter toppl dev       # toppl on :3002
```

Or run everything in parallel:

```bash
pnpm dev
```

Typecheck or test individual apps:

```bash
pnpm --filter ballpark typecheck
pnpm --filter ballpark test
```

Run a script that lives inside Ballpark:

```bash
pnpm ballpark questions:gen --count 100
```

## Deploying to Vercel

Each app is its own Vercel project pointing at the same GitHub repo. The trick is the **Root Directory** setting — Vercel scopes the build to that subfolder.

### Existing Ballpark project (already deployed)

1. Open the Vercel project for `letsballpark.com`.
2. Settings → Build & Development Settings → **Root Directory** → set to `apps/ballpark`.
3. Settings → General → Install Command stays default (`pnpm install`).
4. Trigger a redeploy. Domain, env vars, and Supabase connection all stay the same.

### Portal (new project)

1. Vercel → Add New → Project → import this repo.
2. **Root Directory** → `apps/portal`.
3. Framework preset: Next.js (auto-detected).
4. Add env vars:
   - `NEXT_PUBLIC_PORTAL_URL` → `https://hunch.fun` (or whatever apex domain you choose)
   - `NEXT_PUBLIC_BALLPARK_URL` → `https://letsballpark.com`
   - `NEXT_PUBLIC_TOPPL_URL` → `https://toppl.fun`
5. Deploy. Then assign your portal domain (e.g. `hunch.fun`) in Settings → Domains.

### Toppl (new project)

1. Vercel → Add New → Project → import the same repo.
2. **Root Directory** → `apps/toppl`.
3. Env vars: just `NEXT_PUBLIC_TOPPL_URL` and `NEXT_PUBLIC_PORTAL_URL` for now. Add Supabase keys later when the game is wired up.
4. Deploy. Assign `toppl.fun` (or your chosen domain) in Settings → Domains.

### Domains in one picture

| Domain | Points at |
|---|---|
| doozy.fun | apps/portal |
| ballpark.doozy.fun (+ letsballpark.com) | apps/ballpark |
| toppl.doozy.fun | apps/toppl |

The portal links out to the other two via the env-var URLs. Subdomains don't share cookies, which is exactly what we want — no cross-game session bleed.

### Pricing note

Vercel Hobby allows multiple projects on the same repo at no extra cost. You only pay if a single project exceeds free-tier function invocations or bandwidth.

## Adding a new game later

1. Create `apps/<name>/` with the same skeleton as `apps/toppl/`.
2. Add to `pnpm-workspace.yaml`? (already covered by `apps/*`).
3. Create a new Vercel project pointing at `apps/<name>`.
4. Update the portal's `Shelf.tsx` with the new game entry.
