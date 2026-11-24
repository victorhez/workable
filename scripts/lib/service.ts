// Shared Decide flow used by the CLI and the web server.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { decide, type Activity, type SoilType, type DecideInput } from "../../packages/engine/src/index.ts";
import { makeId, saveDecision, type DecisionRecord } from "../../packages/engine/src/store.ts";
import { message, whatsappLink } from "../../packages/engine/src/message.ts";
import { TelegraphClient } from "../../packages/telegraph/src/index.ts";
import { buyDailyForecast, type BoughtForecast } from "../../packages/telegraph/src/forecast.ts";

export interface DecideRequest { location: string; site_id?: string; activity: Activity; soil: SoilType; initial_storage_frac?: number; mode: "live" | "demo" }

const DEMO_DIR = "fixtures/demo-forecasts";
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

let tg: TelegraphClient | null = null;
const client = () => (tg ??= new TelegraphClient());
export const closeClient = async () => { await tg?.close(); tg = null; };

export function demoForecast(location: string): BoughtForecast | null {
  const f = `${DEMO_DIR}/${slug(location)}.json`;
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
}

export async function runDecide(req: DecideRequest) {
  let forecast: BoughtForecast;
  if (req.mode === "live") {
    forecast = (await buyDailyForecast(client(), req.location)).forecast;
    // Keep the most recent live forecast per place as the demo fixture (real receipts, no funds needed later).
    const prev = demoForecast(req.location);
    const okCount = (f: BoughtForecast) => f.windows.filter((w) => w.parsed).length;
    if (forecast.days.length && (!prev || okCount(forecast) >= okCount(prev))) { mkdirSync(DEMO_DIR, { recursive: true }); writeFileSync(`${DEMO_DIR}/${slug(req.location)}.json`, JSON.stringify(forecast, null, 2)); }
  } else {
    const f = demoForecast(req.location);
    if (!f) throw new Error(`No recorded forecast for "${req.location}". Demo sites: see fixtures/demo-forecasts.`);
    forecast = f;
  }
  const input: DecideInput = {
    activity: req.activity, soil: req.soil,
    initial_storage_frac: req.initial_storage_frac ?? 1.0,
    failed_windows: forecast.windows.filter((w) => !w.parsed).length,
    days: forecast.days.map((d) => ({ date: d.date, rain_mm: d.rain_mm, pop_pct: d.pop_pct, tmax_c: d.tmax_c, tmin_c: d.tmin_c })),
  };
  const decision = decide(input);
  const created_at = new Date().toISOString();
  const rec: DecisionRecord = {
    id: makeId(input, created_at), created_at,
    site: { id: req.site_id, location: req.location },
    input, decision, forecast, cost_usd: forecast.cost_usd,
    outcome_date: forecast.days.at(-1)?.date ?? created_at.slice(0, 10),
    mode: req.mode,
  };
  // Only live decisions are stored and scored; demo replays are previews.
  if (req.mode === "live") saveDecision(rec); else rec.id = "browser-demo";
  const place = req.location.split(",")[0];
  const msg = { en: message(decision, req.activity, place, "en"), pcm: message(decision, req.activity, place, "pcm") };
  return { record: rec, messages: msg, whatsapp: whatsappLink(msg.en) };
}
