-- True-random question picker. The Node route used to LIMIT 50 by natural
-- (insert) order and pick randomly from that window — which meant every
-- multi-player game pulled from the same first 50 rows of questions. Bug.
--
-- This RPC does `order by random()` across the entire pool, excluding any
-- question already used in this room. Single round-trip from the API.
create or replace function public.ballpark_pick_question(p_room_id uuid)
returns public.questions
language sql stable as $$
  select q.*
  from public.questions q
  where q.id not in (
    select r.question_id from public.rounds r where r.room_id = p_room_id
  )
  order by random()
  limit 1;
$$;

grant execute on function public.ballpark_pick_question(uuid) to anon, authenticated, service_role;
