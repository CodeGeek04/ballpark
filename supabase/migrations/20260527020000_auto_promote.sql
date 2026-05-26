-- Auto-promote inserts on questions_review directly into the live pool.
-- The strict validator + tool_use schema makes manual gating low-value
-- for high-volume LLM batches. Admin UI can still demote (delete) later.

create or replace function public.ballpark_auto_promote()
returns trigger language plpgsql as $$
begin
  if new.status = 'pending' then
    insert into public.questions (prompt, answer, unit, category, source_url, cot_hint)
    values (new.prompt, new.answer, new.unit, new.category, new.source_url, new.cot_hint);
    new.status := 'approved';
  end if;
  return new;
end;
$$;

drop trigger if exists ballpark_auto_promote_trg on public.questions_review;
create trigger ballpark_auto_promote_trg
  before insert on public.questions_review
  for each row execute function public.ballpark_auto_promote();

-- Backfill: copy every pending row into the live pool and mark approved.
insert into public.questions (prompt, answer, unit, category, source_url, cot_hint)
select prompt, answer, unit, category, source_url, cot_hint
from public.questions_review
where status = 'pending';

update public.questions_review set status = 'approved' where status = 'pending';
