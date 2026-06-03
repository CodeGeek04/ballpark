-- Hourly cleanup of stale rooms via pg_cron.
-- Abandoned (lobby/playing/revealing) rooms older than 12h are deleted.
-- Completed (status='ended') rooms older than 7d are also deleted.
-- ON DELETE CASCADE on players/rounds/submissions handles the rest.

create extension if not exists pg_cron;

-- Idempotent: unschedule if it already exists so re-running this migration
-- doesn't double-schedule the job.
do $$
begin
  perform cron.unschedule('ballpark-cleanup');
exception when others then null;
end$$;

select cron.schedule(
  'ballpark-cleanup',
  '7 * * * *',   -- 7 minutes past every hour
  $cmd$
    delete from public.rooms
    where (status <> 'ended' and created_at < now() - interval '12 hours')
       or (status = 'ended'  and created_at < now() - interval '7 days');
  $cmd$
);
