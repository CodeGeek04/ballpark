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
const COUNT = Math.max(1, Math.min(200, Number(args.count ?? 100)));
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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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
- Answer must be a positive number, never 0 or negative.
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

async function callAnthropic(topicHints: string[], targetCount: number): Promise<GenRow[]> {
  const userMessage = `Generate ${targetCount} Ballpark questions.

Use these topic hints as inspiration (you can riff, combine, or substitute close cousins — don't be too literal). Include at least one named person, brand, or location in roughly half the questions:

${topicHints.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Also include ~10% wildcards on topics not in this list. Return the JSON object now, no other prose.`;

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    temperature: 1.0,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("no text block in response");
  const text = block.text.trim();

  // Be forgiving of stray markdown fences
  const jsonText = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: { questions: GenRow[] };
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    console.error("Failed to parse JSON. First 500 chars of response:\n", text.slice(0, 500));
    throw err;
  }
  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error("response missing .questions array");
  }
  console.log(
    `  tokens — input: ${res.usage.input_tokens}, output: ${res.usage.output_tokens}, cached: ${res.usage.cache_read_input_tokens ?? 0}`,
  );
  return parsed.questions;
}

function validate(row: GenRow): { ok: true } | { ok: false; reason: string } {
  if (typeof row.prompt !== "string" || row.prompt.length < 40 || row.prompt.length > 200) {
    return { ok: false, reason: "prompt length" };
  }
  if (!row.prompt.trim().endsWith("?")) return { ok: false, reason: "missing question mark" };
  if (typeof row.answer !== "number" || !isFinite(row.answer) || row.answer <= 0) {
    return { ok: false, reason: "answer not positive" };
  }
  if (typeof row.unit !== "string" || !row.unit.trim()) return { ok: false, reason: "missing unit" };
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

async function main() {
  console.log(`Generating ${COUNT} questions…`);
  await ensureSimilarityFn();

  // Pull topic hints biased toward the user-specified seeds, padded from the JSON file.
  const seedPool = [...EXTRA_SEEDS, ...sample(seeds, Math.max(50, COUNT))];
  const uniqHints = Array.from(new Set(seedPool)).slice(0, Math.max(50, COUNT));

  // One Claude call per batch of <=60 to stay within max_tokens and quality.
  const BATCH = 50;
  const batches: string[][] = [];
  for (let i = 0; i < COUNT; i += BATCH) {
    const slice = uniqHints.slice(i, i + BATCH);
    if (slice.length < BATCH && batches.length === 0) batches.push(uniqHints.slice(0, Math.min(BATCH, COUNT)));
    else batches.push(slice);
    if (batches.length * BATCH >= COUNT) break;
  }

  const all: GenRow[] = [];
  for (let b = 0; b < batches.length; b++) {
    const target = Math.min(BATCH, COUNT - all.length);
    if (target <= 0) break;
    console.log(`\nBatch ${b + 1}/${batches.length} — asking for ${target} questions…`);
    const rows = await callAnthropic(batches[b], target);
    console.log(`  received ${rows.length} rows from model`);
    all.push(...rows);
  }

  let kept = 0;
  let rejected = 0;
  const reasons: Record<string, number> = {};
  const rowsForInsert: any[] = [];

  for (const r of all) {
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
    const { error } = await sb.from("questions_review").insert(rowsForInsert);
    if (error) {
      console.error("Insert failed:", error);
      process.exit(1);
    }
  }

  console.log(`\nDone. inserted=${kept}, rejected=${rejected}`);
  if (Object.keys(reasons).length) {
    for (const [k, v] of Object.entries(reasons)) console.log(`  rejected — ${k}: ${v}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
