#!/usr/bin/env tsx
/**
 * Sanity-check the live question pool with Haiku 4.5.
 *
 *   pnpm questions:verify              # check all unverified
 *   pnpm questions:verify --all        # re-check everything
 *   pnpm questions:verify --limit 500  # only first 500 unverified
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const args = parseArgs(process.argv.slice(2));
const ALL = !!args.all;
const LIMIT = args.limit ? Number(args.limit) : undefined;
const CONCURRENCY = Math.max(1, Math.min(8, Number(args.concurrency ?? 4)));
const BATCH = 25;
const FLAG_RATIO = 5; // stored vs estimate off by more than this factor → flag

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 120000,
  maxRetries: 0,
});
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      out[k] = v;
    }
  }
  return out;
}

type Row = { id: string; prompt: string; unit: string | null; answer: number };

const SYSTEM = `You are a Fermi-estimation fact-checker for a game called Ballpark. For each numbered question you receive, you will be told the stored answer. Independently estimate the value yourself using plausible reasoning, then judge whether the stored answer is reasonable.

A stored answer is REASONABLE if your best estimate falls within roughly 5x in either direction (i.e., your estimate / stored is between 0.2 and 5.0). It is OFF if it's beyond that — usually that means either the magnitude is wrong (e.g., per-day vs per-year confusion) or the units don't match the question.

Be a careful estimator. Use rough population, frequency, and rate reasoning. Don't be afraid to say UNSURE if a question is genuinely uncheckable.

Reply via the verify_batch tool with one entry per id in the same order.`;

const VERIFY_TOOL: Anthropic.Tool = {
  name: "verify_batch",
  description: "Submit verification verdicts for a batch of Ballpark questions.",
  input_schema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "The id you were given." },
            estimate: { type: "number", description: "Your independent estimate of the answer." },
            verdict: { type: "string", enum: ["ok", "off", "unsure"] },
            note: { type: "string", description: "One short sentence explaining the verdict." },
          },
          required: ["id", "estimate", "verdict", "note"],
        },
      },
    },
    required: ["results"],
  },
};

async function checkBatch(rows: Row[], attempt = 0): Promise<{ id: string; estimate: number; verdict: string; note: string }[]> {
  const userMessage = `Verify the following ${rows.length} questions. Reply via the verify_batch tool.\n\n${rows
    .map((r, i) => `${i + 1}. id=${r.id} | prompt="${r.prompt}" | unit=${r.unit ?? "?"} | stored_answer=${r.answer}`)
    .join("\n")}`;

  let res;
  try {
    res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      temperature: 0.2,
      system: SYSTEM,
      tools: [VERIFY_TOOL],
      tool_choice: { type: "tool", name: "verify_batch" },
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status;
    const transient = status === 429 || (status >= 500 && status < 600) || /timeout/i.test(String(err?.message));
    if (transient && attempt < 5) {
      const delay = Math.min(20000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 500);
      await new Promise((r) => setTimeout(r, delay));
      return checkBatch(rows, attempt + 1);
    }
    throw err;
  }

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("no tool_use in response");
  const input = block.input as { results?: any[] };
  if (!input.results) throw new Error("missing .results");
  return input.results;
}

async function main() {
  const t0 = Date.now();

  // Supabase PostgREST caps single .select() at 1000 rows; paginate ourselves.
  const PAGE = 1000;
  const all: Row[] = [];
  for (let offset = 0; ; offset += PAGE) {
    let query = sb.from("questions").select("id, prompt, unit, answer");
    if (!ALL) query = query.eq("verify_status", "unverified");
    query = query.range(offset, offset + PAGE - 1);
    const { data, error } = await query;
    if (error) {
      console.error("Failed to fetch:", error);
      process.exit(1);
    }
    const rows = (data as Row[]) ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
    if (LIMIT && all.length >= LIMIT) break;
  }
  const queue = LIMIT ? all.slice(0, LIMIT) : all;
  const total = queue.length;
  console.log(`Verifying ${total} questions in batches of ${BATCH} at concurrency ${CONCURRENCY}…`);
  if (!total) return;

  let processed = 0;
  let flagged = 0;
  let okCount = 0;
  let unsureCount = 0;

  async function worker() {
    while (true) {
      const batch = queue.splice(0, BATCH);
      if (!batch.length) break;
      try {
        const verdicts = await checkBatch(batch);
        const byId = new Map(verdicts.map((v) => [v.id, v]));
        const updates = batch.map((r) => {
          const v = byId.get(r.id);
          if (!v) return null;
          const stored = Number(r.answer);
          const est = Number(v.estimate);
          const ratio = !isFinite(est) || est <= 0 || stored <= 0 ? null : Math.max(stored, est) / Math.min(stored, est);
          let status: "ok" | "flagged" = "ok";
          if (v.verdict === "off") status = "flagged";
          else if (v.verdict === "unsure") status = "ok"; // don't flag the unsures, just record
          else if (ratio !== null && ratio > FLAG_RATIO) status = "flagged";
          if (status === "flagged") flagged++;
          else okCount++;
          if (v.verdict === "unsure") unsureCount++;
          return {
            id: r.id,
            verify_status: status,
            verify_note: `${v.verdict}: ${v.note}`.slice(0, 500),
            verify_estimate: isFinite(est) ? est : null,
            verify_ratio: ratio,
            verified_at: new Date().toISOString(),
          };
        }).filter(Boolean) as any[];

        for (const u of updates) {
          await sb
            .from("questions")
            .update({
              verify_status: u.verify_status,
              verify_note: u.verify_note,
              verify_estimate: u.verify_estimate,
              verify_ratio: u.verify_ratio,
              verified_at: u.verified_at,
            })
            .eq("id", u.id);
        }

        processed += batch.length;
        console.log(
          `[${processed.toString().padStart(4)}/${total}] +${updates.length} | ok=${okCount} flagged=${flagged} unsure=${unsureCount}`,
        );
      } catch (err) {
        console.error(`batch failed:`, (err as Error).message);
        processed += batch.length;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const sec = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`\nDone in ${sec}s. ok=${okCount} flagged=${flagged} unsure=${unsureCount}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
