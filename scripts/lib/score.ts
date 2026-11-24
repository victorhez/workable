// Pure scoring math (unit-tested). No network.
import type { DecisionRecord } from "../../packages/engine/src/store.ts";
import type { Decision, DecideInput } from "../../packages/engine/src/index.ts";

export interface ObservedDay { date: string; rain_mm: number; tmax_c?: number | null; tmin_c?: number | null }
export interface LoggedWindow { location: string; start: string; window_hours: number; rain_mm: number | null; pop_pct: number | null; cost_usd: number }

const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function scoreboard(args: {
  decisions: DecisionRecord[]; logged: LoggedWindow[]; observed: Record<string, ObservedDay[]>;
  today: string; decideFn: (i: DecideInput) => Decision; wetMm: number; source: string;
}) {
  const { decisions, logged, observed, today, decideFn, wetMm } = args;
  const byDate = (loc: string) => new Map((observed[loc] ?? []).map((d) => [d.date, d]));

  // Forecast accuracy by horizon.
  const horizons: Record<string, { n: number; abs_err_sum: number; hits: number; hit_n: number }> = {};
  const forecastRows: any[] = [];
  for (const w of logged) {
    const days = Math.round(w.window_hours / 24);
    const end = addDays(w.start, days - 1);
    if (end >= today) continue;
    const m = byDate(w.location);
    const span = Array.from({ length: days }, (_, i) => m.get(addDays(w.start, i)));
    if (span.some((d) => !d)) continue;
    const obsMm = span.reduce((a, d) => a + d!.rain_mm, 0);
    const h = (horizons[w.window_hours + "h"] ??= { n: 0, abs_err_sum: 0, hits: 0, hit_n: 0 });
    const row: any = { location: w.location, start: w.start, window_hours: w.window_hours, forecast_mm: w.rain_mm, forecast_pop: w.pop_pct, observed_mm: Math.round(obsMm * 10) / 10 };
    if (w.rain_mm !== null) { h.n++; h.abs_err_sum += Math.abs(w.rain_mm - obsMm); row.abs_err_mm = Math.round(Math.abs(w.rain_mm - obsMm) * 10) / 10; }
    const fcWet = w.rain_mm !== null ? w.rain_mm >= wetMm : w.pop_pct !== null ? w.pop_pct >= 50 : null;
    if (fcWet !== null) { h.hit_n++; const hit = fcWet === obsMm >= wetMm; if (hit) h.hits++; row.rain_call_correct = hit; }
    forecastRows.push(row);
  }
  const by_horizon = Object.fromEntries(Object.entries(horizons).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([k, v]) => [k, {
    samples: v.n, mean_abs_error_mm: v.n ? Math.round((v.abs_err_sum / v.n) * 10) / 10 : null,
    rain_no_rain_hit_rate: v.hit_n ? Math.round((v.hits / v.hit_n) * 100) / 100 : null, rain_call_samples: v.hit_n,
  }]));

  // Decisions: correct if the engine, given what actually happened, reaches the same verdict.
  const judged: any[] = [];
  for (const d of decisions) {
    if (d.outcome_date >= today) continue;
    const m = byDate(d.site.location);
    const obsDays = d.input.days.map((x) => m.get(x.date));
    if (obsDays.some((x) => !x)) continue;
    const hindsight = decideFn({ ...d.input, days: obsDays.map((o) => ({ date: o!.date, rain_mm: o!.rain_mm })) });
    const correct = hindsight.verdict === d.decision.verdict;
    let warning_hours: number | null = null;
    if (d.decision.verdict !== "GO" && d.decision.wait_days !== null) {
      const first = obsDays.findIndex((o) => o!.rain_mm >= wetMm);
      if (first >= 0) warning_hours = Math.round((new Date(obsDays[first]!.date + "T00:00:00Z").getTime() - new Date(d.created_at).getTime()) / 36e5);
    }
    judged.push({ id: d.id, mode: d.mode, location: d.site.location, activity: d.input.activity, verdict: d.decision.verdict, hindsight_verdict: hindsight.verdict, correct, cost_usd: d.cost_usd, warning_hours });
  }
  const correct = judged.filter((j) => j.correct).length;
  const cost = judged.reduce((a, j) => a + (j.cost_usd ?? 0), 0);
  const alerts = judged.filter((j) => j.verdict !== "GO");
  const usefulAlerts = alerts.filter((j) => j.correct).length;
  const warn = judged.map((j) => j.warning_hours).filter((x): x is number => x !== null && x > 0);

  return {
    generated_at: new Date().toISOString(),
    observed_source: args.source,
    summary: {
      decisions_total: decisions.length,
      decisions_judged: judged.length,
      decisions_pending: decisions.length - judged.length,
      decisions_correct: correct,
      accuracy: judged.length ? Math.round((correct / judged.length) * 100) / 100 : null,
      cost_per_correct_decision_usd: correct ? Math.round((cost / correct) * 1000) / 1000 : null,
      cost_per_useful_alert_usd: usefulAlerts ? Math.round((alerts.reduce((a, j) => a + j.cost_usd, 0) / usefulAlerts) * 1000) / 1000 : null,
      median_hours_of_warning: warn.length ? warn.sort((a, b) => a - b)[Math.floor(warn.length / 2)] : null,
      forecast_windows_scored: forecastRows.length,
      sample_size_note: judged.length < 30 ? `Small sample (${judged.length} judged decisions, ${forecastRows.length} forecast windows). Treat these numbers as early indications, not proof.` : null,
    },
    by_horizon, judged, forecasts: forecastRows,
  };
}
