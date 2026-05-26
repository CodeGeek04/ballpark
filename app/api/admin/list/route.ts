import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

function checkAuth(req: Request) {
  return req.headers.get("x-admin-pass") === process.env.ADMIN_REVIEW_PASSWORD;
}

export async function GET(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getServiceClient();
  const { data: pending } = await sb
    .from("questions_review")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);
  const { count: liveCount } = await sb
    .from("questions")
    .select("id", { count: "exact", head: true });
  const { count: pendingCount } = await sb
    .from("questions_review")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return NextResponse.json({ pending, liveCount, pendingCount });
}
