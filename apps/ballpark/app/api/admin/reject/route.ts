import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (req.headers.get("x-admin-pass") !== process.env.ADMIN_REVIEW_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = (await req.json()) as { id: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const sb = getServiceClient();
  await sb.from("questions_review").update({ status: "rejected" }).eq("id", id);
  return NextResponse.json({ ok: true });
}
