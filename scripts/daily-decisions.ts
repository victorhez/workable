// Daily evidence run: one live decision per tracked site, activity rotating by day.
// Each decision buys 24/48/72/120h windows, so short windows close fast and feed the scoreboard.
// Spending cap: WORKABLE_DAILY_CAP_USD (default 0.60). Stops early if escrow is low.
// Usage: npm run daily  |  npm run daily -- kano jos
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { runDecide, closeClient } from "./lib/service.ts";
import { TelegraphClient } from "../packages/telegraph/src/index.ts";

const CAP = Number(process.env.WORKABLE_DAILY_CAP_USD ?? 0.6);
const MIN_ESCROW = 0.3; // key mode: Telegraph holds $0.26 per ask while it runs, whatever the client asks for
const MAX_FAILS_IN_A_ROW = 2; // stop early if Telegraph is down or funds are short, so failed asks do not tie up escrow
const sites: any[] = JSON.parse(readFileSync("fixtures/sites.json", "utf8"));
const only = process.argv.slice(2);
const todo = only.length ? sites.filter((s) => only.includes(s.id)) : sites;
const dayIndex = Math.floor(Date.now() / 86_400_000);

async function balance(): Promise<number | null> {
  const tg = new TelegraphClient();
  try {
    const a: any = await tg.account();
    const v = Number(a?.escrow?.spendable_usd ?? a?.escrow?.spendable_usdc);
    mkdirSync("data", { recursive: true });
    writeFileSync("data/account.json", JSON.stringify({ checked_at: new Date().toISOString(), spendable_usd: isFinite(v) ? v : null, mode: a?.mode ?? null }, null, 2));
    return isFinite(v) ? v : null;
  } catch (e) { console.error("balance check failed:", (e as Error).message.slice(0, 160)); return null; }
  finally { await tg.close(); }
}

let spent = 0, made = 0, failsInARow = 0;
const start = await balance();
console.log(`escrow before: ${start ?? "unknown"} USD · cap ${CAP} USD`);
try {
  for (const s of todo) {
    if (failsInARow >= MAX_FAILS_IN_A_ROW) { console.log(`${failsInARow} sites in a row failed completely; stopping. Check escrow (claim the faucet, add to escrow) and Telegraph status, then rerun.`); break; }
    if (spent + 0.04 > CAP) { console.log(`cap reached ($${spent.toFixed(2)}); stopping`); break; }
    if (start !== null && start - spent < MIN_ESCROW + 0.04) { console.log("escrow low; stopping. Claim the faucet and add to escrow."); break; }
    const activity = s.activities[dayIndex % s.activities.length];
    try {
      const { record } = await runDecide({ location: s.location, site_id: s.id, activity, soil: s.soil, mode: "live" });
      spent += record.cost_usd; made++; failsInARow = 0;
      const ok = (record.forecast as any).windows.filter((w: any) => w.parsed).length;
      console.log(`[${s.id}] ${activity}: ${record.decision.verdict}${record.decision.wait_days ? " " + record.decision.wait_days + "d" : ""} (${record.decision.confidence}) $${record.cost_usd.toFixed(2)} windows ${ok}/4 id ${record.id}`);
    } catch (e) { failsInARow++; console.log(`[${s.id}] FAILED: ${(e as Error).message.slice(0, 220)}`); }
  }
} finally { await closeClient(); }
await balance();
console.log(`done: ${made}/${todo.length} decisions, spent $${spent.toFixed(2)}`);
