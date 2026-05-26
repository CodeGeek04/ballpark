-- Ensure UPDATE/DELETE realtime payloads carry full row data.
alter table public.rooms replica identity full;
alter table public.players replica identity full;
alter table public.rounds replica identity full;
alter table public.submissions replica identity full;
