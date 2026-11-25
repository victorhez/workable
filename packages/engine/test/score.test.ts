import { it, expect } from "vitest";
import { decide } from "../src/index.ts";
import { scoreboard } from "../../../scripts/lib/score.ts";
import { windowsToDays } from "../../telegraph/src/forecast.ts";

const p = (rain_mm: number | null, pop = 0) => ({ temp_max_c: 30, temp_min_c: 20, pop_pct: pop, rain_mm, condition: null, from_text: [], sources: [], text: null });

it("windowsToDays differences cumulative windows and spreads the last", () => {
  const { days, notes } = windowsToDays("2026-11-24", [
    { window_hours: 24, receipt_id: "a", cost_usd: 0.01, parsed: p(2) },
    { window_hours: 48, receipt_id: "b", cost_usd: 0.01, parsed: p(5) },
    { window_hours: 72, receipt_id: "c", cost_usd: 0.01, parsed: p(5) },
    { window_hours: 120, receipt_id: "d", cost_usd: 0.01, parsed: p(15) },
  ]);
  expect(days.map((d) => d.rain_mm)).toEqual([2, 3, 0, 5, 5]);
  expect(days.map((d) => d.date)).toEqual(["2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28"]);
  expect(notes.join(" ")).toMatch(/spread evenly/);
});

it("scoreboard judges a decision against observed weather and computes cost per correct", () => {
  const input = { activity: "mine" as const, soil: "loam" as const, days: [{ date: "2026-11-01", rain_mm: 0 }, { date: "2026-11-02", rain_mm: 20 }] };
  const rec: any = { id: "x", created_at: "2026-11-01T06:00:00Z", site: { location: "Kano, Nigeria" }, input, decision: decide(input), forecast: {}, cost_usd: 0.04, outcome_date: "2026-11-02", mode: "live" };
  const b = scoreboard({
    decisions: [rec], logged: [{ location: "Kano, Nigeria", start: "2026-11-01", window_hours: 48, rain_mm: 20, pop_pct: 80, cost_usd: 0.01 }],
    observed: { "Kano, Nigeria": [{ date: "2026-11-01", rain_mm: 0 }, { date: "2026-11-02", rain_mm: 18 }] },
    today: "2026-11-10", decideFn: decide, wetMm: 2, source: "test",
  });
  expect(b.summary).toMatchObject({ decisions_judged: 1, decisions_correct: 1, cost_per_correct_decision_usd: 0.04, median_hours_of_warning: 18 });
  expect(b.by_horizon["48h"]).toMatchObject({ samples: 1, mean_abs_error_mm: 2, rain_no_rain_hit_rate: 1 });
});

it("windowsToDays flags a window total that shrinks and does not use it", () => {
  const { days, notes } = windowsToDays("2026-11-24", [
    { window_hours: 24, receipt_id: "a", cost_usd: 0.01, parsed: p(6) },
    { window_hours: 48, receipt_id: "b", cost_usd: 0.01, parsed: p(4) },
    { window_hours: 72, receipt_id: "c", cost_usd: 0.01, parsed: p(9) },
  ]);
  expect(days[1]).toMatchObject({ rain_mm: null, rain_quality: "inconsistent" });
  expect(days[2]).toMatchObject({ rain_mm: 3, rain_quality: "stated" });
  expect(notes.join(" ")).toMatch(/not cumulative/);
});

it("windowsToDays marks missing amounts as estimated and multi-day windows as spread", () => {
  const { days } = windowsToDays("2026-11-24", [
    { window_hours: 24, receipt_id: "a", cost_usd: 0.01, parsed: p(null, 40) },
    { window_hours: 72, receipt_id: "b", cost_usd: 0.01, parsed: p(null, 40) },
    { window_hours: 120, receipt_id: "c", cost_usd: 0.01, parsed: p(null, 40) },
  ]);
  expect(days.map((d) => d.rain_quality)).toEqual(["estimated", "estimated", "estimated", "estimated", "estimated"]);
  const s = windowsToDays("2026-11-24", [{ window_hours: 24, receipt_id: "a", cost_usd: 0.01, parsed: p(0) }, { window_hours: 72, receipt_id: "b", cost_usd: 0.01, parsed: p(4) }]).days;
  expect(s.map((d) => d.rain_quality)).toEqual(["stated", "spread", "spread"]);
});
