import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { trackIdentity } from "@/lib/track-identity";
import type { RoomMode } from "@/lib/types";

export const runtime = "nodejs";

type Body = { mode: RoomMode; hostName: string; hostAvatar: string };

export async function POST(req: Request) {
  try {
    const { mode, hostName, hostAvatar } = (await req.json()) as Body;
    if (!mode || !hostName || !hostAvatar) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }
    void trackIdentity(req, hostName);
    const sb = getServiceClient();
    const { data, error } = await sb.rpc("toppl_create_room", {
      p_mode: mode,
      p_name: hostName,
      p_avatar: hostAvatar,
      p_start_round: mode === "solo",
    });
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "create failed" }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
