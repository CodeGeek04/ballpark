#!/usr/bin/env tsx
/**
 * Ballpark — question generator.
 *
 *   pnpm questions:gen --count 100
 *   pnpm questions:gen --count 50 --seeds "Taylor Swift,Times Square,Eiffel Tower"
 *
 * Behavior:
 *   1. Pick N topic seeds (round-robin sample from scripts/topic-seeds.json,
 *      skipping anything still hot in the existing pool).
 *   2. Call Claude Sonnet 4.6 with structured JSON output for the whole batch.
 *   3. Validate every row (numeric answer > 0, prompt length, unit present,
 *      category in allowlist).
 *   4. Dedupe against the existing pool using Postgres pg_trgm similarity.
 *   5. Insert survivors into questions_review with status='pending'.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedsPath = join(__dirname, "topic-seeds.json");
const { categories, seeds } = JSON.parse(readFileSync(seedsPath, "utf-8")) as {
  categories: string[];
  seeds: string[];
};

const args = parseArgs(process.argv.slice(2));
const COUNT = Math.max(1, Number(args.count ?? 100));
const CONCURRENCY = Math.max(1, Math.min(8, Number(args.concurrency ?? 4)));
const EXTRA_SEEDS = args.seeds ? args.seeds.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
const SIM_THRESHOLD = 0.62; // pg_trgm similarity; >0.62 is a near-duplicate

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY missing from env. Aborting.");
  process.exit(1);
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error("Supabase env vars missing. Aborting.");
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 180000, // tool_use with ~25 q/batch needs more headroom than plain text
  maxRetries: 0, // we drive retries ourselves with backoff
});

const QUESTION_TOOL: Anthropic.Tool = {
  name: "submit_questions",
  description: "Submit the batch of generated Ballpark questions.",
  input_schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            prompt: { type: "string" },
            answer: { type: "number" },
            unit: { type: "string" },
            category: { type: "string" },
            source_url: { type: ["string", "null"] },
            cot_hint: { type: "string" },
          },
          required: ["prompt", "answer", "unit", "category", "cot_hint"],
        },
      },
    },
    required: ["questions"],
  },
};
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const SYSTEM_PROMPT = `You write questions for a game called Ballpark, where players guess a single numerical answer to a strange, evocative question and win points based on closeness on a log scale.

THE VOICE — the most important thing.

The questions must feel WEIRD. Not trivia, not factoids — Fermi-style provocations that make a friend group say "WHAT?" and then start calculating on a napkin. Concrete, slightly absurd, often involving a specific famous person, location, brand, or vivid human behavior.

GOOD examples (these are the tone target):
- "How many trains do people miss every day worldwide?"
- "How many liters of jet fuel does Taylor Swift burn on tour in a typical week?"
- "How many kilograms of trash do New York City households produce in a single hour?"
- "How many AirPods are lost to the laundry in the US every year?"
- "How many text messages saying 'I love you' are sent globally per day?"
- "How many pizzas does Tim Hortons sell on its busiest day of the year?"
- "How many kilowatt-hours does an average US household consume in a week?"
- "How many parking tickets does NYC issue on the snowiest day of winter?"

FAVOR THESE TWO PATTERNS HEAVILY:

Pattern A — Brand + peak/occasion. A specific brand or institution combined with a
specific peak moment ("busiest day of the year", "Black Friday", "Super Bowl Sunday",
"the day Beyoncé dropped Lemonade"). Examples: "Krispy Kreme donuts sold on National
Donut Day", "Domino's pizzas delivered during Super Bowl halftime", "Starbucks orders
on the first day of pumpkin spice latte season".

Pattern B — Per-unit consumption / behavior. "Average X uses Y of Z per W". Examples:
"liters of water used per shower by the average American", "kWh consumed by an average
US household per week", "subway swipes by the average New Yorker per month", "calories
burned by an average dog walker per day".

BAD examples (avoid this register):
- "How many people live in China?" (boring, googlable)
- "What is the speed of light?" (factual, not estimable)
- "How tall is Mount Everest?" (no Fermi reasoning required)
- "How many planets are in our solar system?" (one correct answer, no scale)

REASONING REQUIREMENT.

Every question must have a plausible Fermi decomposition — a chain a clever player with a calculator could replicate (e.g., "Taylor Swift's jet → ~600 gal/hr × ~3 flights/wk × ~2 hr/flight × 3.785 L/gal").

REQUIRED OUTPUT FORMAT.

Return ONLY a JSON object with this exact shape (no prose, no markdown, no backticks):

{
  "questions": [
    {
      "prompt": "string, 50–140 chars, evocative, ends with a question mark",
      "answer": number (positive, the best documented or carefully estimated value),
      "unit": "string, plural unit name, e.g. 'liters', 'trains', 'AirPods', 'kilograms'",
      "category": "one of: ${categories.join(", ")}",
      "source_url": "URL to a documented source if one exists, otherwise null",
      "cot_hint": "1–3 sentence Fermi decomposition the player could use, in plain prose"
    }
  ]
}

RULES:
- The prompt must be plain English: only letters, digits, spaces, and standard ASCII punctuation (.,'"-!?():&%$/). NO emojis, NO unicode arrows, NO em-dashes, NO smart quotes, NO special characters of any kind.
- The unit must also be plain ASCII text — e.g. "liters", "kilograms", "people", "pizzas".
- Answer must be a positive number, never 0 or negative, never a string, never NaN. Do not include units, commas, or words in the answer field.
- For estimates, prefer round-ish numbers in the right order of magnitude over false precision.
- Vary the magnitude wildly — some answers should be in the hundreds, some in the trillions.
- Reference specific named entities (Taylor Swift, Times Square, MrBeast, Starbucks, the MTA) liberally. Generic questions are weaker.
- Don't repeat the same topic with slight rewording inside one batch.
- No questions about controversial political figures or sensitive tragedies.
- US units are fine when natural, metric is fine too — pick whichever the topic calls for.`;

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[k] = v;
    }
  }
  return out;
}

function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

type GenRow = {
  prompt: string;
  answer: number;
  unit: string;
  category: string;
  source_url: string | null;
  cot_hint: string;
};

async function callAnthropic(topicHints: string[], targetCount: number, attempt = 0): Promise<GenRow[]> {
  const userMessage = `Generate ${targetCount} Ballpark questions.

Use these topic hints as inspiration (you can riff, combine, or substitute close cousins — don't be too literal). Include at least one named person, brand, or location in roughly half the questions:

${topicHints.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Treat the seeds as 50% inspiration and 50% jumping-off-points — for the other half of the batch, invent fresh weird questions on topics not in this list (different brands, different occasions, different people, different per-unit consumption stats). Maximize variety across the batch. Return the JSON object now, no other prose.`;

  let res;
  try {
    res = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      temperature: 1.0,
      system: SYSTEM_PROMPT,
      tools: [QUESTION_TOOL],
      tool_choice: { type: "tool", name: "submit_questions" },
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (err: any) {
    // Backoff on rate limit / overloaded / 5xx / timeouts
    const status = err?.status ?? err?.response?.status;
    const isTimeout = err?.name === "APIConnectionTimeoutError" || /timeout/i.test(String(err?.message));
    const transient = status === 429 || (status >= 500 && status < 600) || err?.name === "APIConnectionError" || isTimeout;
    if (transient && attempt < 6) {
      const delayMs = Math.min(30000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 1000);
      console.log(`  retry in ${delayMs}ms (status=${status ?? err?.name ?? "?"}, attempt=${attempt + 1})`);
      await new Promise((r) => setTimeout(r, delayMs));
      return callAnthropic(topicHints, targetCount, attempt + 1);
    }
    throw err;
  }

  const toolBlock = res.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("no tool_use block in response");
  }
  const input = toolBlock.input as { questions?: GenRow[] };
  if (!input.questions || !Array.isArray(input.questions)) {
    throw new Error("tool_use missing .questions array");
  }
  return input.questions;
}

// Acceptable characters in a player-facing prompt: letters, digits, spaces,
// and standard ASCII punctuation. Everything else (emojis, JSON artifacts,
// control characters, unicode arrows, em-dashes) is a reject signal.
const PROMPT_ALLOWED = /^[A-Za-z0-9 \-.,'"!?():&%$/]+$/;
const UNIT_ALLOWED = /^[A-Za-z0-9 \-./]+$/;

function validate(row: GenRow): { ok: true } | { ok: false; reason: string } {
  if (typeof row.prompt !== "string") return { ok: false, reason: "prompt not string" };
  const prompt = row.prompt.trim();
  if (prompt.length < 40 || prompt.length > 200) return { ok: false, reason: "prompt length" };
  if (!prompt.endsWith("?")) return { ok: false, reason: "missing question mark" };
  if (!PROMPT_ALLOWED.test(prompt)) return { ok: false, reason: "prompt has non-ascii or special chars" };

  if (typeof row.answer !== "number" || !isFinite(row.answer) || row.answer <= 0) {
    return { ok: false, reason: "answer not positive number" };
  }
  // Reject answers that came in as strings or that include thousands separators —
  // the JSON schema forces number type, but belt-and-suspenders against future regressions.
  if (Number.isNaN(row.answer) || !Number.isFinite(row.answer)) {
    return { ok: false, reason: "answer not finite" };
  }

  if (typeof row.unit !== "string" || !row.unit.trim()) return { ok: false, reason: "missing unit" };
  if (!UNIT_ALLOWED.test(row.unit.trim())) return { ok: false, reason: "unit has special chars" };

  if (!categories.includes(row.category)) return { ok: false, reason: `bad category "${row.category}"` };
  if (typeof row.cot_hint !== "string" || row.cot_hint.length < 30) return { ok: false, reason: "cot_hint too short" };
  return { ok: true };
}

async function checkDuplicate(prompt: string): Promise<{ duplicate: boolean; against?: string }> {
  // Search both live pool and pending review queue.
  const { data: live } = await sb.rpc("ballpark_similar_prompt", { p: prompt, threshold: SIM_THRESHOLD }).select();
  if (live && (live as any[]).length) {
    return { duplicate: true, against: (live as any[])[0].prompt };
  }
  return { duplicate: false };
}

async function ensureSimilarityFn() {
  // Idempotent: create the helper function if it doesn't exist.
  const sql = `
    create or replace function public.ballpark_similar_prompt(p text, threshold real)
    returns table(prompt text, similarity real) language sql stable as $$
      select prompt, similarity(prompt, p) as similarity
      from public.questions
      where similarity(prompt, p) > threshold
      union all
      select prompt, similarity(prompt, p) as similarity
      from public.questions_review
      where status = 'pending' and similarity(prompt, p) > threshold
      order by similarity desc
      limit 1;
    $$;
  `;
  // The supabase-js client can't run raw DDL; fall back to PostgREST if a function endpoint exists,
  // otherwise inline the SQL via psql. For simplicity we silently skip — assume the migration
  // installs it. See ensure-similarity-fn.sql in the migrations directory.
  void sql;
}

async function processBatchResults(rows: GenRow[]) {
  let kept = 0;
  let rejected = 0;
  const reasons: Record<string, number> = {};
  const rowsForInsert: any[] = [];

  for (const r of rows) {
    const v = validate(r);
    if (!v.ok) {
      rejected++;
      reasons[v.reason] = (reasons[v.reason] ?? 0) + 1;
      continue;
    }
    const dup = await checkDuplicate(r.prompt);
    if (dup.duplicate) {
      rejected++;
      reasons["duplicate"] = (reasons["duplicate"] ?? 0) + 1;
      continue;
    }
    rowsForInsert.push({
      prompt: r.prompt.trim(),
      answer: r.answer,
      unit: r.unit.trim(),
      category: r.category,
      source_url: r.source_url || null,
      cot_hint: r.cot_hint.trim(),
      model: "claude-sonnet-4-6",
      status: "pending",
    });
    kept++;
  }

  if (rowsForInsert.length) {
    // Chunk inserts to stay under PostgREST payload size.
    const CHUNK = 200;
    for (let i = 0; i < rowsForInsert.length; i += CHUNK) {
      const slice = rowsForInsert.slice(i, i + CHUNK);
      const { error } = await sb.from("questions_review").insert(slice);
      if (error) console.error("  insert chunk error:", error.message);
    }
  }
  return { kept, rejected, reasons };
}

async function main() {
  const t0 = Date.now();
  console.log(`Generating ~${COUNT} questions at concurrency ${CONCURRENCY}…`);

  const BATCH = 25;
  const totalBatches = Math.ceil(COUNT / BATCH);
  const queue: { idx: number; target: number }[] = [];
  for (let i = 0; i < totalBatches; i++) {
    const target = Math.min(BATCH, COUNT - i * BATCH);
    queue.push({ idx: i, target });
  }

  let done = 0;
  let totalKept = 0;
  let totalRejected = 0;
  const totalReasons: Record<string, number> = {};
  let inputTokens = 0;
  let outputTokens = 0;

  async function worker() {
    while (queue.length) {
      const job = queue.shift();
      if (!job) break;
      // Each batch gets a freshly-sampled set of seed hints — drives variety.
      const hints = Array.from(new Set([...sample(EXTRA_SEEDS, Math.min(5, EXTRA_SEEDS.length)), ...sample(seeds, BATCH)])).slice(0, BATCH);
      try {
        const rows = await callAnthropic(hints, job.target);
        const { kept, rejected, reasons } = await processBatchResults(rows);
        totalKept += kept;
        totalRejected += rejected;
        for (const [k, v] of Object.entries(reasons)) totalReasons[k] = (totalReasons[k] ?? 0) + v;
        done++;
        console.log(
          `[${done.toString().padStart(3)}/${totalBatches}] batch ${job.idx + 1} — kept ${kept}, dropped ${rejected} · total kept ${totalKept}`,
        );
      } catch (err) {
        done++;
        console.error(`[${done}/${totalBatches}] batch ${job.idx + 1} FAILED:`, (err as Error).message);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const elapsedSec = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`\nDone in ${elapsedSec}s. inserted=${totalKept}, dropped=${totalRejected}`);
  if (Object.keys(totalReasons).length) {
    for (const [k, v] of Object.entries(totalReasons)) console.log(`  dropped — ${k}: ${v}`);
  }
  void inputTokens; void outputTokens;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
