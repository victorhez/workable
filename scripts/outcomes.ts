// Accountability: fetch observed weather, judge decisions and forecasts, write data/scoreboard.json.
// Observed source: Open-Meteo (CC BY 4.0), NOT bought through Telegraph; labelled as such everywhere.
// Usage: npm run outcomes
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { decide, RULES } from "../packages/engine/src/index.ts";
import { listDecisions } from "../packages/engine/src/store.ts";
import { scoreboard, type ObservedDay, type LoggedWindow } from "./lib/score.ts";

const OBS_SOURCE = "Open-Meteo (open-meteo.com, CC BY 4.0) recent analysis; not bought through Telegraph";
const today = new Date().toISOString().slice(0, 10);

async function geocode(location: string): Promise<{ lat: number; lon: number } | null> {
  const name = location.split(",")[0].trim();
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5`);
  const j: any = await r.json();
  const country = location.split(",").at(-1)!.trim().toLowerCase();
  const hit = (j.results ?? []).find((x: any) => String(x.country ?? "").toLowerCase().includes(country) || country.includes(String(x.country_code ?? "").toLowerCase())) ?? j.results?.[0];
  return hit ? { lat: hit.latitude, lon: hit.longitude } : null;
}

async function observed(location: string): Promise<ObservedDay[]> {
  const g = await geocode(location);
  if (!g) return [];
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${g.lat}&longitude=${g.lon}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&past_days=31&forecast_days=1&timezone=UTC`;
  const j: any = await (await fetch(url)).json();
  const t: string[] = j.daily?.time ?? [];
  return t.map((date, i) => ({ date, rain_mm: j.daily.precipitation_sum[i], tmax_c: j.daily.temperature_2m_max[i], tmin_c: j.daily.temperature_2m_min[i] }))
    .filter((d) => d.date < today && d.rain_mm !== null);
}

const decisions = listDecisions();
const logged: LoggedWindow[] = [];
if (existsSync("data/forecasts.jsonl")) {
  for (const l of readFileSync("data/forecasts.jsonl", "utf8").split("\n").filter(Boolean)) {
    const x = JSON.parse(l);
    if (x.parsed) logged.push({ location: x.location, start: x.logged_at.slice(0, 10), window_hours: x.window_hours, rain_mm: x.parsed.rain_mm, pop_pct: x.parsed.pop_pct, cost_usd: x.cost_usd ?? 0 });
  }
}
for (const d of decisions) for (const w of (d.forecast as any)?.windows ?? []) {
  if (w.parsed) logged.push({ location: d.site.location, start: d.created_at.slice(0, 10), window_hours: w.window_hours, rain_mm: w.parsed.rain_mm, pop_pct: w.parsed.pop_pct, cost_usd: w.cost_usd ?? 0 });
}

const places = [...new Set([...decisions.map((d) => d.site.location), ...logged.map((l) => l.location)])];
mkdirSync("data/observed", { recursive: true });
const obs: Record<string, ObservedDay[]> = {};
for (const p of places) {
  try { obs[p] = await observed(p); writeFileSync(`data/observed/${p.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`, JSON.stringify(obs[p], null, 2)); }
  catch (e) { console.error(`observed fetch failed for ${p}: ${(e as Error).message}`); obs[p] = []; }
}

const board = scoreboard({ decisions, logged, observed: obs, today, decideFn: decide, wetMm: RULES.wet_day_mm, source: OBS_SOURCE });
writeFileSync("data/scoreboard.json", JSON.stringify(board, null, 2));
console.log(JSON.stringify(board.summary, null, 2));
