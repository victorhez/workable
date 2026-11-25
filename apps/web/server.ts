// Local server: live (paid) and demo decisions, decision pages, scoreboard. npm run serve
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { CONFIG_VERSION, RULES, SOILS, SOIL_DEPTH_CM } from "../../packages/engine/src/index.ts";
import { listDecisions, loadDecision, reproduce } from "../../packages/engine/src/store.ts";
import { runDecide, demoForecast } from "../../scripts/lib/service.ts";
import { stats } from "../../scripts/lib/stats.ts";

import { build } from "esbuild";
await build({ entryPoints: ["scripts/browser-entry.ts"], bundle: true, format: "iife", globalName: "Workable", outfile: "apps/web/public/engine.js", platform: "browser", logLevel: "warning" });

const PORT = Number(process.env.PORT ?? 5175);
const PUBLIC = "apps/web/public";
const LIVE_ENABLED = !!(process.env.TELEGRAPH_API_KEY || process.env.TELEGRAPH_PRIVATE_KEY || existsSync(join(process.env.USERPROFILE ?? process.env.HOME ?? "", ".telegraph/wallet.json")));
const LIVE_MIN_GAP_MS = 60_000;
let lastLive = 0, liveBusy = false;

const sites = () => JSON.parse(readFileSync("fixtures/sites.json", "utf8")).map((s: any) => ({ ...s, demo: !!demoForecast(s.location) }));
const summary = (r: any) => ({ id: r.id, created_at: r.created_at, location: r.site.location, activity: r.input.activity, soil: r.input.soil, verdict: r.decision.verdict, wait_days: r.decision.wait_days, cost_usd: r.cost_usd, mode: r.mode });
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const send = (code: number, body: unknown) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  try {
    if (url.pathname === "/api/health") return send(200, { server: true, live: LIVE_ENABLED });
    if (url.pathname === "/api/sites") return send(200, sites());
    if (url.pathname === "/api/stats") return send(200, stats());
    if (url.pathname === "/api/config") return send(200, { version: CONFIG_VERSION, soils: SOILS, rules: RULES, depth_cm: SOIL_DEPTH_CM });
    if (url.pathname === "/api/decisions") return send(200, listDecisions().map(summary).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    if (url.pathname.startsWith("/api/decision/")) {
      const rec = loadDecision(url.pathname.split("/").pop()!);
      return rec ? send(200, { ...rec, reproduced: reproduce(rec).identical }) : send(404, { error: "not found" });
    }
    if (url.pathname === "/api/scoreboard") return existsSync("data/scoreboard.json") ? send(200, JSON.parse(readFileSync("data/scoreboard.json", "utf8"))) : send(200, null);
    if (url.pathname === "/api/decide" && req.method === "POST") {
      let raw = ""; for await (const c of req) raw += c;
      const body = JSON.parse(raw || "{}");
      if (body.mode === "live") {
        if (!LIVE_ENABLED) return send(400, { error: "Live mode needs a Telegraph key or wallet on this server." });
        if (liveBusy) return send(429, { error: "A live purchase is already running." });
        if (Date.now() - lastLive < LIVE_MIN_GAP_MS) return send(429, { error: "Live mode is rate-limited to one purchase a minute." });
        liveBusy = true; lastLive = Date.now();
      }
      try { return send(200, await runDecide({ location: body.location, site_id: body.site_id, activity: body.activity, soil: body.soil, initial_storage_frac: body.initial_storage_frac, mode: body.mode === "live" ? "live" : "demo" })); }
      finally { if (body.mode === "live") liveBusy = false; }
    }
    const path = normalize(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^(\.\.[/\\])+/, "");
    const file = join(PUBLIC, path);
    if (file.startsWith(normalize(PUBLIC)) && existsSync(file)) { res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }); return res.end(readFileSync(file)); }
    res.writeHead(200, { "content-type": TYPES[".html"] }); res.end(readFileSync(join(PUBLIC, "index.html")));
  } catch (e) { send(500, { error: (e as Error).message }); }
}).listen(PORT, () => console.log(`Workable on http://localhost:${PORT}  (live mode ${LIVE_ENABLED ? "available" : "off"})`));
