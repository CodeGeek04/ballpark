export type RoomMode = "solo" | "ffa" | "teams";
export type RoomStatus = "lobby" | "playing" | "revealing" | "ended";

export type Question = {
  id: string;
  prompt: string;
  answer: number;
  unit: string | null;
  category: string | null;
  source_url: string | null;
  k: number;
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
  team: "A" | "B" | null;
  is_host: boolean;
  joined_at: string;
};

export type Round = {
  id: string;
  room_id: string;
  index: number;
  question_id: string;
  started_at: string;
  deadline_at: string;
  revealed_at: string | null;
};

export type Submission = {
  id: string;
  round_id: string;
  player_id: string;
  team: "A" | "B" | null;
  guess: number;
  submitted_at: string;
  score: number | null;
};
