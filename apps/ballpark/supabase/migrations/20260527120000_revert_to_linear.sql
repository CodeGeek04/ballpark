-- Revert: keep the original linear scoring curve with k=1.5.
-- Race-condition fixes from earlier migrations stay in place — only the
-- curve formula is reverted.

update public.questions set k = 1.5 where k = 2;
alter table public.questions alter column k set default 1.5;

create or replace function public.ballpark_reveal_round(p_round_id uuid)
returns jsonb
language plpgsql as $$
declare
  v_round public.rounds;
  v_question public.questions;
  v_room public.rooms;
  v_subs jsonb;
  v_is_last boolean;
begin
  select * into v_round from public.rounds where id = p_round_id;
  if v_round.id is null then
    raise exception 'round not found';
  end if;

  select * into v_question from public.questions where id = v_round.question_id;
  if v_question.id is null then
    raise exception 'question missing';
  end if;

  select * into v_room from public.rooms where id = v_round.room_id;

  if v_round.revealed_at is null then
    update public.submissions s
    set score = greatest(
      0,
      round(1000 * (1 - least(1, abs(log(s.guess / v_question.answer)) / v_question.k)))::int
    )
    where s.round_id = p_round_id
      and s.guess > 0
      and v_question.answer > 0;

    update public.submissions
    set score = 0
    where round_id = p_round_id and score is null;

    update public.rounds set revealed_at = now() where id = p_round_id
    returning * into v_round;

    v_is_last := v_round.index >= v_room.round_count;
    update public.rooms
    set status = case when v_is_last then 'ended' else 'revealing' end
    where id = v_room.id
    returning * into v_room;
  end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.submitted_at), '[]'::jsonb)
  into v_subs
  from public.submissions s
  where s.round_id = p_round_id;

  return jsonb_build_object(
    'question', to_jsonb(v_question),
    'round',    to_jsonb(v_round),
    'submissions', v_subs
  );
end;
$$;

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

-- Re-score every existing submission back with the linear curve.
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
where s.round_id = r.id;
