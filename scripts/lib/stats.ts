// Headline numbers for the overview page, computed from stored records only.
import { existsSync, readFileSync } from "node:fs";
import { listDecisions, reproduce } from "../../packages/engine/src/store.ts";
import { loadReceipts } from "../../packages/telegraph/src/index.ts";

export function stats() {
  const decisions = listDecisions();
  const receipts = loadReceipts();
  const paid = receipts.filter((r) => typeof r.cost_usd === "number" && (r.response as any)?.status !== "failed");
  const spend = paid.reduce((a, r) => a + (r.cost_usd ?? 0), 0);
  const reproduced = decisions.filter((d) => reproduce(d).identical).length;
  const board = existsSync("data/scoreboard.json") ? JSON.parse(readFileSync("data/scoreboard.json", "utf8")) : null;
  const verdicts = { GO: 0, WAIT: 0, AVOID: 0 } as Record<string, number>;
  for (const d of decisions) verdicts[d.decision.verdict]++;
  const miners = new Set<string>();
  for (const r of paid) for (const m of (Array.isArray(r.miner) ? r.miner : [r.miner]) as any[]) if (m?.slug || m?.name) miners.add(m.slug ?? m.name);
  return {
    decisions: decisions.length,
    live_decisions: decisions.filter((d) => d.mode === "live").length,
    purchases: paid.length,
    spend_usd: Math.round(spend * 100) / 100,
    avg_cost_per_decision_usd: decisions.length ? Math.round((decisions.reduce((a, d) => a + d.cost_usd, 0) / decisions.length) * 1000) / 1000 : null,
    reproduced, reproduced_pct: decisions.length ? Math.round((100 * reproduced) / decisions.length) : null,
    verdicts,
    miners_used: [...miners],
    sites: new Set(decisions.map((d) => d.site.location)).size,
    judged: board?.summary?.decisions_judged ?? 0,
    accuracy: board?.summary?.accuracy ?? null,
    last_purchase_at: paid.map((r) => r.time).sort().at(-1) ?? null,
  };
}
