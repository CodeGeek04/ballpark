-- Tighten the value-ratio window so pairs are genuinely close.
-- Old: 1.4x to 1000x (e.g. 100 vs 100000 — trivial)
-- New: 1.3x to 4x (still a clear winner but you have to think)

create or replace function toppl.toppl_create_room(
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
  new_room toppl.rooms;
  new_player toppl.players;
  new_round toppl.rounds;
  item_a toppl.items;
  item_b toppl.items;
  attempt int := 0;
begin
  loop
    new_code := '';
    for i in 1..4 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into toppl.rooms (code, mode)
      values (new_code, p_mode)
      returning * into new_room;
      exit;
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt > 6 then raise exception 'could not allocate code'; end if;
    end;
  end loop;

  insert into toppl.players (room_id, name, avatar, is_host)
  values (new_room.id, p_name, p_avatar, true)
  returning * into new_player;

  update toppl.rooms set host_player_id = new_player.id where id = new_room.id
  returning * into new_room;

  if p_start_round then
    select * into item_a from toppl.items order by random() limit 1;
    select i.* into item_b
    from toppl.items i
    where i.id <> item_a.id
      and (greatest(i.value, item_a.value) / nullif(least(i.value, item_a.value), 0)) between 1.3 and 4
    order by random()
    limit 1;
    if item_b.id is null then
      -- fall back to a wider gap if no close pair exists
      select i.* into item_b
      from toppl.items i
      where i.id <> item_a.id
        and (greatest(i.value, item_a.value) / nullif(least(i.value, item_a.value), 0)) between 1.3 and 10
      order by random()
      limit 1;
    end if;
    if item_b.id is null then
      raise exception 'not enough close-value items in pool';
    end if;

    insert into toppl.rounds (room_id, index, item_a_id, item_b_id, deadline_at)
    values (new_room.id, 1, item_a.id, item_b.id, now() + (new_room.round_seconds || ' seconds')::interval)
    returning * into new_round;

    update toppl.rooms set status = 'playing', current_round = 1 where id = new_room.id
    returning * into new_room;
  end if;

  return jsonb_build_object(
    'room', to_jsonb(new_room),
    'player', to_jsonb(new_player),
    'round', case when new_round.id is not null then to_jsonb(new_round) else null end,
    'item_a', case when item_a.id is not null then to_jsonb(item_a) else null end,
    'item_b', case when item_b.id is not null then to_jsonb(item_b) else null end
  );
end;
$$;

create or replace function toppl.toppl_pick_pair(p_room_id uuid)
returns table(item_a jsonb, item_b jsonb)
language plpgsql as $$
declare
  used_ids uuid[];
  a toppl.items;
  b toppl.items;
begin
  select array_agg(item_id) into used_ids from (
    select item_a_id as item_id from toppl.rounds where room_id = p_room_id
    union all
    select item_b_id from toppl.rounds where room_id = p_room_id
  ) u;
  used_ids := coalesce(used_ids, ARRAY[]::uuid[]);

  select * into a from toppl.items
  where not (id = any(used_ids))
  order by random() limit 1;
  if a.id is null then
    raise exception 'no unused items in pool';
  end if;

  -- Primary window: 1.3x to 4x — close enough to make you think.
  select i.* into b from toppl.items i
  where i.id <> a.id
    and not (i.id = any(used_ids))
    and (greatest(i.value, a.value) / nullif(least(i.value, a.value), 0)) between 1.3 and 4
  order by random()
  limit 1;
  if b.id is null then
    -- Secondary window: open up to 10x if no close match.
    select i.* into b from toppl.items i
    where i.id <> a.id
      and not (i.id = any(used_ids))
      and (greatest(i.value, a.value) / nullif(least(i.value, a.value), 0)) between 1.3 and 10
    order by random()
    limit 1;
  end if;
  if b.id is null then
    -- Final fallback: any distinct unused item.
    select i.* into b from toppl.items i
    where i.id <> a.id and not (i.id = any(used_ids))
    order by random() limit 1;
    if b.id is null then
      raise exception 'pool exhausted';
    end if;
  end if;

  return query select to_jsonb(a), to_jsonb(b);
end;
$$;
