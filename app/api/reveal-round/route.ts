import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Body = { roundId: string };

export async function POST(req: Request) {
  const { roundId } = (await req.json()) as Body;
  if (!roundId) return NextResponse.json({ error: "missing fields" }, { status: 400 });

  const sb = getServiceClient();

  // Single RPC: scores all submissions, flips round.revealed_at, updates
  // rooms.status, and returns the full result set. One Vercel→Supabase
  // round-trip instead of the 6-12 the JS version was making.
  const { data, error } = await sb.rpc("ballpark_reveal_round", { p_round_id: roundId });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
