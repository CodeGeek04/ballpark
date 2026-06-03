-- Atomic reveal: score every submission, mark the round revealed, and update
-- the room status in a single round-trip. The Node route previously did up
-- to 12 sequential DB calls for an 8-person room (per-submission UPDATE loop
-- plus reads), each paying a Vercel→Supabase hop.

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

  -- If already revealed, just return current data idempotently.
  if v_round.revealed_at is null then
    -- Score every submission in one statement using the log-accuracy formula.
    -- score = max(0, round(1000 * (1 - least(1, |log10(guess/answer)| / k))))
    update public.submissions s
    set score = greatest(
      0,
      round(1000 * (1 - least(1, abs(log(s.guess / v_question.answer)) / v_question.k)))::int
    )
    where s.round_id = p_round_id
      and s.guess > 0
      and v_question.answer > 0;

    -- Subs that don't pass the positive-guess guard get 0.
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

grant execute on function public.ballpark_reveal_round(uuid) to anon, authenticated, service_role;
