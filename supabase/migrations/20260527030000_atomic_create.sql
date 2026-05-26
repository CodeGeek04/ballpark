-- Collapse create-room + (optional) start-round into a single round-trip.
-- Previously the API hit Supabase 3 times: insert room, insert player,
-- update room with host_player_id. For solo, the client then did a second
-- API hit for start-round. Now: one function call does everything atomically.

create or replace function public.ballpark_create_room(
  p_mode text,
  p_name text,
  p_avatar text,
  p_start_round boolean default false
)
returns jsonb
language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  new_room public.rooms;
  new_player public.players;
  new_round public.rounds;
  chosen_question public.questions;
  attempt int := 0;
begin
  -- Allocate a unique 4-char code with retry on collision.
  loop
    new_code := '';
    for i in 1..4 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.rooms (code, mode)
      values (new_code, p_mode)
      returning * into new_room;
      exit;
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt > 6 then raise exception 'could not allocate code'; end if;
    end;
  end loop;

  -- Insert the host player.
  insert into public.players (room_id, name, avatar, is_host, team)
  values (
    new_room.id, p_name, p_avatar, true,
    case when p_mode = 'teams' then 'A' else null end
  )
  returning * into new_player;

  -- Backfill host pointer.
  update public.rooms set host_player_id = new_player.id where id = new_room.id
  returning * into new_room;

  -- Optionally start the first round inline (for solo). This skips a whole
  -- client-side round-trip.
  if p_start_round then
    select * into chosen_question
    from public.questions
    order by random()
    limit 1;

    if chosen_question.id is null then
      raise exception 'no questions available';
    end if;

    insert into public.rounds (room_id, index, question_id, deadline_at)
    values (
      new_room.id, 1, chosen_question.id,
      now() + (new_room.round_seconds || ' seconds')::interval
    )
    returning * into new_round;

    update public.rooms
    set status = 'playing', current_round = 1
    where id = new_room.id
    returning * into new_room;
  end if;

  return jsonb_build_object(
    'room', to_jsonb(new_room),
    'player', to_jsonb(new_player),
    'round', case when new_round.id is not null then to_jsonb(new_round) else null end,
    'question', case when chosen_question.id is not null
      then jsonb_build_object(
        'id', chosen_question.id,
        'prompt', chosen_question.prompt,
        'unit', chosen_question.unit,
        'category', chosen_question.category,
        'k', chosen_question.k
      )
      else null end
  );
end;
$$;

grant execute on function public.ballpark_create_room(text, text, text, boolean) to anon, authenticated, service_role;
