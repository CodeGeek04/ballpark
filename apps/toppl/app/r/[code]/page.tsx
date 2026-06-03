import { notFound } from "next/navigation";
import { getServiceClient } from "@/lib/supabase-server";
import { RoomClient } from "./_components/RoomClient";
import type { Item, Player, Pick, Room, Round } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const sb = getServiceClient();
  const { data: room } = await sb.from("rooms").select("*").eq("code", code.toUpperCase()).maybeSingle();
  if (!room) notFound();

  const [{ data: players }, { data: latestRound }] = await Promise.all([
    sb.from("players").select("*").eq("room_id", room.id).order("joined_at"),
    sb.from("rounds").select("*").eq("room_id", room.id).order("index", { ascending: false }).limit(1).maybeSingle(),
  ]);

  let initialItemA: Item | null = null;
  let initialItemB: Item | null = null;
  let initialPicks: Pick[] = [];

  if (latestRound) {
    const r = latestRound as Round;
    const [{ data: a }, { data: b }, { data: picks }] = await Promise.all([
      sb.from("items").select("*").eq("id", r.item_a_id).single(),
      sb.from("items").select("*").eq("id", r.item_b_id).single(),
      sb.from("picks").select("*").eq("round_id", r.id),
    ]);
    initialItemA = (a as Item) ?? null;
    initialItemB = (b as Item) ?? null;
    initialPicks = (picks as Pick[]) ?? [];
  }

  return (
    <RoomClient
      initialRoom={room as Room}
      initialPlayers={(players as Player[]) ?? []}
      initialRound={(latestRound as Round) ?? null}
      initialItemA={initialItemA}
      initialItemB={initialItemB}
      initialPicks={initialPicks}
    />
  );
}
