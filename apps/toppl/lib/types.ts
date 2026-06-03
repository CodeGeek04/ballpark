export type RoomMode = "solo" | "multi";
export type RoomStatus = "lobby" | "playing" | "revealing" | "ended";

export type Item = {
  id: string;
  prompt: string;
  value: number;
  unit: string;
  category: string | null;
  source_url: string | null;
};

export type Room = {
  id: string;
  code: string;
  mode: RoomMode;
  round_count: number;
  round_seconds: number;
  status: RoomStatus;
  current_round: number;
  host_player_id: string | null;
  created_at: string;
};

export type Player = {
  id: string;
  room_id: string;
  name: string;
  avatar: string;
  is_host: boolean;
  best_streak: number;
  current_streak: number;
  total_correct: number;
  joined_at: string;
};

export type Round = {
  id: string;
  room_id: string;
  index: number;
  item_a_id: string;
  item_b_id: string;
  started_at: string;
  deadline_at: string;
  revealed_at: string | null;
};

export type Pick = {
  id: string;
  round_id: string;
  player_id: string;
  picked_item_id: string;
  is_correct: boolean | null;
  picked_at: string;
};
