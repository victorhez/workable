// Static build for hosting (Vercel/any static host): demo mode runs in the browser on recorded real receipts.
// npm run build  ->  dist/
import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { CONFIG_VERSION, RULES, SOILS, SOIL_DEPTH_CM } from "../packages/engine/src/index.ts";
import { listDecisions, reproduce } from "../packages/engine/src/store.ts";
import { stats } from "./lib/stats.ts";
import { summaryBody, summaryPage } from "./lib/summary.ts";
import { loadReceipts } from "../packages/telegraph/src/index.ts";

// Empty dist/ rather than deleting it (Windows refuses to remove a folder that is some process's cwd).
mkdirSync("dist", { recursive: true });
for (const f of readdirSync("dist")) if (f !== ".vercel") rmSync(`dist/${f}`, { recursive: true, force: true });
cpSync("apps/web/public", "dist", { recursive: true });
mkdirSync("dist/data/decision", { recursive: true });
await build({ entryPoints: ["scripts/browser-entry.ts"], bundle: true, format: "iife", globalName: "Workable", outfile: "dist/engine.js", minify: true, platform: "browser" });

const w = (p: string, v: unknown) => writeFileSync(`dist/data/${p}`, JSON.stringify(v));
const demo: Record<string, unknown> = {};
if (existsSync("fixtures/demo-forecasts")) for (const f of readdirSync("fixtures/demo-forecasts")) demo[f.replace(/\.json$/, "")] = JSON.parse(readFileSync(`fixtures/demo-forecasts/${f}`, "utf8"));
const sites = JSON.parse(readFileSync("fixtures/sites.json", "utf8")).map((s: any) => ({ ...s, demo: !!demo[s.location.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")] }));
const decisions = listDecisions().sort((a, b) => b.created_at.localeCompare(a.created_at));

const st = stats();
w("sites.json", sites);
w("stats.json", st);
w("receipts.json", loadReceipts().sort((a, b) => b.time.localeCompare(a.time)).map((r) => ({
  id: r.id, time: r.time, intent: r.intent, params: r.params, cost_usd: r.cost_usd, miner: r.miner,
  status: (r.response as any)?.status ?? "complete", response_sha256: r.response_sha256,
})));
w("index.json", { name: "Workable open data", endpoints: ["/data/stats.json", "/data/decisions.json", "/data/decision/{id}.json", "/data/receipts.json", "/data/scoreboard.json", "/data/config.json", "/data/sites.json", "/data/demo-forecasts.json"], decision_page: "/d/{id}", summary: "/summary" });
w("demo-forecasts.json", demo);
w("config.json", { version: CONFIG_VERSION, soils: SOILS, rules: RULES, depth_cm: SOIL_DEPTH_CM });
w("decisions.json", decisions.map((r) => ({ id: r.id, created_at: r.created_at, location: r.site.location, activity: r.input.activity, soil: r.input.soil, verdict: r.decision.verdict, wait_days: r.decision.wait_days, cost_usd: r.cost_usd, mode: r.mode })));
for (const r of decisions) w(`decision/${r.id}.json`, { ...r, reproduced: reproduce(r).identical });
w("scoreboard.json", existsSync("data/scoreboard.json") ? JSON.parse(readFileSync("data/scoreboard.json", "utf8")) : null);
const list = decisions.map((r) => ({ id: r.id, created_at: r.created_at, location: r.site.location, activity: r.input.activity, verdict: r.decision.verdict, wait_days: r.decision.wait_days, cost_usd: r.cost_usd }));
const body = summaryBody(st, existsSync("data/scoreboard.json") ? JSON.parse(readFileSync("data/scoreboard.json", "utf8")) : null, list);
writeFileSync("dist/summary.html", summaryPage(body));
// Put the same summary inside the app shell so crawlers and no-JS readers see real content; the app replaces it on load.
const shell = readFileSync("dist/index.html", "utf8");
writeFileSync("dist/index.html", shell.replace('<main id="app" aria-live="polite"></main>', `<main id="app" aria-live="polite">${body}</main>`));
writeFileSync("dist/vercel.json", JSON.stringify({ cleanUrls: true, rewrites: [{ source: "/d/:id", destination: "/" }] }));
console.log(`dist/ built: ${sites.length} sites, ${Object.keys(demo).length} demo forecasts, ${decisions.length} decisions`);
