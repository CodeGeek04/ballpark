#!/usr/bin/env tsx
/**
 * Toppl item generator. Each item is a single concrete quantity that can
 * be compared "bigger or smaller" against another item.
 *
 *   pnpm items:gen --count 200 --concurrency 4
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const args = parseArgs(process.argv.slice(2));
const COUNT = Math.max(1, Number(args.count ?? 100));
const CONCURRENCY = Math.max(1, Math.min(6, Number(args.concurrency ?? 3)));
const SIM_THRESHOLD = 0.75;

if (!process.env.ANTHROPIC_API_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env vars. Need ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 180000,
  maxRetries: 0,
});
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const CATEGORIES = [
  "Pop Culture",
  "Sports",
  "Geography",
  "Food & Drink",
  "Industry & Trade",
  "Money",
  "Biology",
  "Technology",
  "Human Behavior",
  "Time & History",
];

const SYSTEM_PROMPT = `You generate items for a guessing game called Toppl. Each round, players see two items and pick which has the bigger numerical value.

An item is ONE specific quantity. Examples:
- {prompt: "Population of Mumbai metro area", value: 21700000, unit: "people"}
- {prompt: "Taylor Swift's Instagram followers", value: 283000000, unit: "followers"}
- {prompt: "Sixes hit by MS Dhoni in his IPL career", value: 240, unit: "sixes"}

THE VOICE.

Items should be surprising and concrete. Use specific brands, celebrities, cities, events when possible. Mix vast and tiny quantities. Roughly 30-40% should have Indian / South Asian / desi flavor (Bollywood, IPL, Mumbai, chai, Bangalore traffic, Indian weddings, Diwali, Zomato, Swiggy, Indian Railways, etc.). The rest can be global.

GOOD examples of the energy:
- "Cups of chai consumed in India per day"
- "Diyas lit across India on Diwali night"
- "Sixes hit by Chris Gayle in his career"
- "AirPods lost to the laundry in the US per year"
- "Pizzas Tim Hortons sells on Roll Up the Rim day"

BAD examples (avoid):
- "Population of the world" (too well known)
- "Speed of light" (constant, not estimable)
- "Color of the sky" (not a number)

RULES.

- prompt: 30-110 chars, plain English, no question mark at the end. ASCII only.
- unit: plain plural noun like "people", "cups", "kilograms", "songs", "rupees". ASCII only.
- value: a positive number. Must be a number (no string, no commas).
- category: one of: ${CATEGORIES.join(", ")}
- source_url: a real source URL if you know one, otherwise null.

Use the submit_items tool to return your batch.`;

const ITEM_TOOL: Anthropic.Tool = {
  name: "submit_items",
  description: "Submit a batch of Toppl items.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            prompt: { type: "string" },
            value: { type: "number" },
            unit: { type: "string" },
            category: { type: "string" },
            source_url: { type: ["string", "null"] },
          },
          required: ["prompt", "value", "unit", "category"],
        },
      },
    },
    required: ["items"],
  },
};

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

type Row = { prompt: string; value: number; unit: string; category: string; source_url: string | null };

const PROMPT_ALLOWED = /^[A-Za-z0-9 \-.,'"():&%$/]+$/;
const UNIT_ALLOWED = /^[A-Za-z0-9 \-./]+$/;

function validate(r: Row): { ok: true } | { ok: false; reason: string } {
  if (typeof r.prompt !== "string") return { ok: false, reason: "prompt" };
  const p = r.prompt.trim();
  if (p.length < 20 || p.length > 140) return { ok: false, reason: "prompt length" };
  if (!PROMPT_ALLOWED.test(p)) return { ok: false, reason: "prompt special chars" };
  if (typeof r.value !== "number" || !isFinite(r.value) || r.value <= 0) return { ok: false, reason: "value" };
  if (typeof r.unit !== "string" || !UNIT_ALLOWED.test(r.unit.trim())) return { ok: false, reason: "unit" };
  if (!CATEGORIES.includes(r.category)) return { ok: false, reason: `category ${r.category}` };
  return { ok: true };
}

async function checkDup(prompt: string): Promise<boolean> {
  const { data } = await sb.rpc("toppl_similar_item", { p: prompt, threshold: SIM_THRESHOLD }).select();
  return !!(data && (data as { prompt: string }[]).length);
}

async function callAnthropic(target: number, attempt = 0): Promise<Row[]> {
  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 6000,
      temperature: 1.0,
      system: SYSTEM_PROMPT,
      tools: [ITEM_TOOL],
      tool_choice: { type: "tool", name: "submit_items" },
      messages: [
        {
          role: "user",
          content: `Generate ${target} fresh Toppl items spanning all categories. Maximize variety. Include desi / Indian items in roughly a third of the batch.`,
        },
      ],
    });
    const tool = res.content.find((b) => b.type === "tool_use");
    if (!tool || tool.type !== "tool_use") throw new Error("no tool_use");
    const input = tool.input as { items?: Row[] };
    if (!input.items) throw new Error("no items");
    return input.items;
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status;
    const transient = status === 429 || (status >= 500 && status < 600) || /timeout/i.test(String(err?.message));
    if (transient && attempt < 5) {
      const delay = Math.min(30000, 1000 * 2 ** attempt);
      await new Promise((r) => setTimeout(r, delay));
      return callAnthropic(target, attempt + 1);
    }
    throw err;
  }
}

async function main() {
  const t0 = Date.now();
  const BATCH = 25;
  const totalBatches = Math.ceil(COUNT / BATCH);
  const queue = Array.from({ length: totalBatches }, (_, i) => Math.min(BATCH, COUNT - i * BATCH));

  let done = 0;
  let kept = 0;
  let dropped = 0;
  const reasons: Record<string, number> = {};

  async function worker() {
    while (queue.length) {
      const target = queue.shift();
      if (!target) break;
      try {
        const rows = await callAnthropic(target);
        const inserts: any[] = [];
        for (const r of rows) {
          const v = validate(r);
          if (!v.ok) { dropped++; reasons[v.reason] = (reasons[v.reason] ?? 0) + 1; continue; }
          if (await checkDup(r.prompt)) { dropped++; reasons.duplicate = (reasons.duplicate ?? 0) + 1; continue; }
          inserts.push({
            prompt: r.prompt.trim(),
            value: r.value,
            unit: r.unit.trim(),
            category: r.category,
            source_url: r.source_url || null,
            model: "claude-sonnet-4-6",
            status: "pending",
          });
        }
        if (inserts.length) {
          const { error } = await sb.from("items_review").insert(inserts);
          if (error) console.error("insert error:", error.message);
        }
        kept += inserts.length;
        done++;
        console.log(`[${done}/${totalBatches}] +${inserts.length} kept, total ${kept}`);
      } catch (e) {
        done++;
        console.error(`batch failed:`, (e as Error).message);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const sec = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`\nDone in ${sec}s. kept=${kept} dropped=${dropped}`);
  for (const [k, v] of Object.entries(reasons)) console.log(`  ${k}: ${v}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
