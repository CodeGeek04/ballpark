-- Backstop for the reveal/submit race: if a submission insert happens after
-- the round is already revealed (network jitter), score it on insert using
-- the same formula as ballpark_reveal_round. Without this, the row stays
-- with score=NULL and the player sees +0.

create or replace function public.ballpark_score_on_insert()
returns trigger language plpgsql as $$
declare
  v_revealed_at timestamptz;
  v_answer numeric;
  v_k numeric;
begin
  select r.revealed_at, q.answer, q.k
  into v_revealed_at, v_answer, v_k
  from public.rounds r
  join public.questions q on q.id = r.question_id
  where r.id = new.round_id;

  -- Only intervene when the round is already revealed. Otherwise the
  -- normal reveal flow will score this row.
  if v_revealed_at is not null and new.score is null then
    if new.guess > 0 and v_answer > 0 then
      new.score := greatest(
        0,
        round(1000 * (1 - least(1, abs(log(new.guess / v_answer)) / v_k)))::int
      );
    else
      new.score := 0;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ballpark_score_on_insert_trg on public.submissions;
create trigger ballpark_score_on_insert_trg
  before insert on public.submissions
  for each row execute function public.ballpark_score_on_insert();

-- Retroactively score any orphan submissions (score IS NULL on a revealed
-- round) using the same formula. One-shot backfill.
update public.submissions s
set score = greatest(
  0,
  case
    when s.guess > 0 and q.answer > 0
    then round(1000 * (1 - least(1, abs(log(s.guess / q.answer)) / q.k)))::int
    else 0
  end
)
from public.rounds r
join public.questions q on q.id = r.question_id
where s.round_id = r.id
  and r.revealed_at is not null
  and s.score is null;
