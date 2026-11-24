// Turn several window purchases (24h, 48h, 72h, 120h) into daily values, in code.
import type { TelegraphClient, Receipt } from "./index.ts";
import { FORECAST_INTENT } from "./index.ts";
import { parseForecastAnswer, type ParsedForecast } from "./parse.ts";

export const HORIZONS = [24, 48, 72, 120];

export interface WindowForecast { window_hours: number; receipt_id: string | null; cost_usd: number | null; parsed: ParsedForecast | null; miner_label?: string; receipt_hash?: string; error?: string }

export interface DailyDay { date: string; rain_mm: number | null; pop_pct: number | null; tmax_c: number | null; tmin_c: number | null; derived: string }

export interface BoughtForecast {
  location: string;
  bought_at: string;
  windows: WindowForecast[];
  days: DailyDay[];
  cost_usd: number;
  notes: string[];
}

const addDays = (iso: string, n: number) => { const d = new Date(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Pure: build daily values from cumulative windows. Exported for tests and reproduce. */
export function windowsToDays(start: string, windows: WindowForecast[]): { days: DailyDay[]; notes: string[] } {
  const notes: string[] = [];
  const ok = windows.filter((w) => w.parsed).sort((a, b) => a.window_hours - b.window_hours);
  const days: DailyDay[] = [];
  let prevH = 0, prevMm: number | null = 0;
  for (const w of ok) {
    const p = w.parsed!;
    const n = Math.round((w.window_hours - prevH) / 24);
    if (n <= 0) continue;
    let perDay: number | null = null;
    if (p.rain_mm !== null && prevMm !== null) perDay = Math.max(0, p.rain_mm - prevMm) / n;
    for (let i = 0; i < n; i++) {
      days.push({
        date: addDays(start, days.length),
        rain_mm: perDay === null ? null : Math.round(perDay * 100) / 100,
        pop_pct: p.pop_pct,
        tmax_c: p.temp_max_c, tmin_c: p.temp_min_c,
        derived: n === 1 ? `window ${prevH}-${w.window_hours}h` : `window ${prevH}-${w.window_hours}h spread evenly over ${n} days`,
      });
    }
    if (n > 1) notes.push(`Rain for hours ${prevH}-${w.window_hours} was spread evenly over ${n} days.`);
    prevH = w.window_hours;
    prevMm = p.rain_mm;
  }
  const failed = windows.filter((w) => !w.parsed);
  if (failed.length) notes.push(`${failed.length} window purchase(s) failed: ${failed.map((w) => w.window_hours + "h").join(", ")}. Confidence lowered.`);
  if (days.some((d) => d.rain_mm === null)) notes.push("Some windows gave no rain amount; the engine estimates it from the rain probability.");
  return { days, notes };
}

export async function buyDailyForecast(tg: TelegraphClient, location: string, horizons = HORIZONS): Promise<{ forecast: BoughtForecast; receipts: Receipt[] }> {
  const bought_at = new Date().toISOString();
  const receipts: Receipt[] = [];
  // Sequential: the account allows only a few concurrent jobs (HTTP 429 otherwise).
  const windows: WindowForecast[] = [];
  for (const h of horizons) windows.push(await buyWindow(h));

  async function buyWindow(h: number): Promise<WindowForecast> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await tg.ask(FORECAST_INTENT, { location, window_hours: h });
        receipts.push(r);
        const m: any[] = Array.isArray(r.miner) ? r.miner : r.miner ? [r.miner] : [];
        return {
          window_hours: h, receipt_id: r.id, cost_usd: r.cost_usd, parsed: parseForecastAnswer(r.response),
          miner_label: m.map((x) => [x.name ?? x.slug ?? x, x.rank ? `rank ${x.rank}` : ""].filter(Boolean).join(", ")).join("; ") || undefined,
          receipt_hash: m.map((x) => x.receiptHash).filter(Boolean).join(", ") || undefined,
        };
      } catch (e) {
        const msg = (e as Error).message;
        if (attempt === 3) return { window_hours: h, receipt_id: null, cost_usd: null, parsed: null, error: msg.slice(0, 200) };
        await new Promise((r) => setTimeout(r, /429|already have/i.test(msg) ? 30_000 : 5_000));
      }
    }
    throw new Error("unreachable");
  }
  const { days, notes } = windowsToDays(bought_at.slice(0, 10), windows);
  const cost_usd = Math.round(windows.reduce((a, w) => a + (w.cost_usd ?? 0), 0) * 100) / 100;
  return { forecast: { location, bought_at, windows, days, cost_usd, notes }, receipts };
}
