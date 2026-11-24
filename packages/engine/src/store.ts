// Decision records: everything needed to re-run a decision exactly.
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { decide, type DecideInput, type Decision } from "./index.ts";

export interface DecisionRecord {
  id: string;
  created_at: string;
  site: { id?: string; location: string };
  input: DecideInput;
  decision: Decision;
  forecast: unknown;        // the BoughtForecast (windows, receipt ids, costs, notes)
  cost_usd: number;
  outcome_date: string;     // last forecast day; judge after this
  mode: "live" | "demo";
}

export const DECISIONS_DIR = "data/decisions";

export function makeId(input: DecideInput, created_at: string) {
  return "wk_" + createHash("sha256").update(created_at + JSON.stringify(input)).digest("hex").slice(0, 10);
}

export function saveDecision(rec: DecisionRecord, dir = DECISIONS_DIR) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${rec.id}.json`), JSON.stringify(rec, null, 2));
}

export function loadDecision(id: string, dir = DECISIONS_DIR): DecisionRecord | null {
  const f = join(dir, `${id}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
}

export function listDecisions(dir = DECISIONS_DIR): DecisionRecord[] {
  try { return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, f), "utf8"))); }
  catch { return []; }
}

export function reproduce(rec: DecisionRecord): { identical: boolean; rerun: Decision } {
  const failed = (rec.forecast as any)?.windows?.filter((w: any) => !w.parsed).length ?? 0;
  const input = rec.input.failed_windows === undefined ? { ...rec.input, failed_windows: failed } : rec.input;
  const rerun = decide(input);
  // Older records lowered confidence outside the engine and have no failed_purchases flag.
  if (rec.input.failed_windows === undefined) rerun.flags = rerun.flags.filter((f) => f !== "failed_purchases");
  return { identical: JSON.stringify(rerun) === JSON.stringify(rec.decision), rerun };
}
