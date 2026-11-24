// Daily logger: buy one forecast per site through Telegraph and append it to data/forecasts.jsonl.
// Usage: npm run log            (all sites)   |   npm run log -- ibadan kano
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { TelegraphClient, FORECAST_INTENT } from "../packages/telegraph/src/index.ts";
import { parseForecastAnswer } from "../packages/telegraph/src/parse.ts";

const WINDOW_HOURS = Number(process.env.WORKABLE_WINDOW_HOURS ?? 120);
const sites: { id: string; location: string }[] = JSON.parse(readFileSync("fixtures/sites.json", "utf8"));
const only = process.argv.slice(2);
const todo = only.length ? sites.filter((s) => only.includes(s.id)) : sites;

mkdirSync("data", { recursive: true });
const tg = new TelegraphClient();
let ok = 0;
try {
  for (const site of todo) {
    const t = Date.now();
    let attempt = 0, line: Record<string, unknown> | null = null;
    while (attempt < 2 && !line) {
      attempt++;
      try {
        const r = await tg.ask(FORECAST_INTENT, { location: site.location, window_hours: WINDOW_HOURS });
        line = {
          logged_at: r.time, site: site.id, location: site.location, window_hours: WINDOW_HOURS,
          receipt_id: r.id, cost_usd: r.cost_usd, miner: r.miner, response_sha256: r.response_sha256,
          parsed: parseForecastAnswer(r.response), ms: Date.now() - t, attempts: attempt,
        };
      } catch (e) {
        console.error(`[${site.id}] attempt ${attempt} failed: ${(e as Error).message.slice(0, 200)}`);
      }
    }
    line ??= { logged_at: new Date().toISOString(), site: site.id, location: site.location, error: "purchase failed", attempts: attempt };
    appendFileSync("data/forecasts.jsonl", JSON.stringify(line) + "\n");
    if (!line.error) ok++;
    console.log(`[${site.id}] ${line.error ? "FAILED" : "ok"} in ${Date.now() - t}ms`, JSON.stringify((line as any).parsed ?? {}));
  }
  console.log(`done: ${ok}/${todo.length} sites logged`);
} finally {
  await tg.close();
}
