-- Upsert helper: bumps visit_count + last_seen, replaces name with latest.
create or replace function public.ballpark_track_identity(p_ip_hash text, p_name text)
returns void
language sql as $$
  insert into public.player_identities (ip_hash, name)
  values (p_ip_hash, p_name)
  on conflict (ip_hash) do update
    set name = excluded.name,
        last_seen = now(),
        visit_count = public.player_identities.visit_count + 1;
$$;

grant execute on function public.ballpark_track_identity(text, text) to service_role;
