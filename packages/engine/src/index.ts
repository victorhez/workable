import { CONFIG_VERSION, RULES, SOILS, type SoilType } from "./config.ts";
export * from "./config.ts";

export interface DayForecast {
  date: string;             // YYYY-MM-DD
  rain_mm?: number | null;  // preferred
  pop_pct?: number | null;  // fallback when mm is not provided
  tmax_c?: number | null;
  tmin_c?: number | null;
  rain_quality?: "stated" | "spread" | "estimated" | "inconsistent"; // how the daily amount was obtained
}

export type Activity = "plant" | "field_work" | "harvest" | "mine";

export interface DecideInput {
  activity: Activity;
  soil: SoilType;
  initial_storage_frac?: number; // S0 as a share of field capacity; default 1.0 (wet, conservative)
  failed_windows?: number;       // forecast purchases that failed; each lowers confidence
  et_mm_day?: number;            // site evaporation default (simplification); falls back to RULES.et_mm_day
  rules_version?: number;        // 2 = stricter confidence caps (Nov 25). Absent = v1, kept so old records reproduce exactly.
  days: DayForecast[];
}

export interface DayState { date: string; rain_mm: number; estimated: boolean; quality?: string; storage_mm: number; workable: boolean }

export interface Decision {
  verdict: "GO" | "WAIT" | "AVOID";
  wait_days: number | null;
  reasons: string[];
  would_change: string;
  confidence: "high" | "medium" | "low";
  days_to_workable: number | null; // null = not within the forecast
  path: DayState[];
  config_version: string;
  flags: string[];
}

export function rainOf(d: DayForecast): { mm: number; estimated: boolean } {
  if (typeof d.rain_mm === "number") return { mm: Math.max(0, d.rain_mm), estimated: false };
  if (typeof d.pop_pct === "number") return { mm: (Math.min(100, Math.max(0, d.pop_pct)) / 100) * RULES.rain_if_wet_mm, estimated: true };
  return { mm: 0, estimated: true };
}

/** Daily bucket: +rain, -ET, drain a share of excess above FC, clamp to [0, sat]. */
export function soilPath(soil: SoilType, days: DayForecast[], s0frac = 1.0, et = RULES.et_mm_day): DayState[] {
  const p = SOILS[soil];
  let s = Math.min(p.sat_mm, Math.max(0, s0frac * p.fc_mm));
  return days.map((d) => {
    const r = rainOf(d);
    s = s + r.mm - et;
    if (s > p.fc_mm) s -= (s - p.fc_mm) * p.drain_frac;
    s = Math.min(p.sat_mm, Math.max(0, s));
    const round = Math.round(s * 100) / 100;
    const quality = d.rain_quality; // only present on v2 inputs, so v1 records reproduce byte-for-byte
    return { date: d.date, rain_mm: Math.round(r.mm * 100) / 100, estimated: r.estimated, ...(quality ? { quality } : {}), storage_mm: round, workable: round <= p.workable_frac * p.fc_mm };
  });
}

export function decide(input: DecideInput): Decision {
  const v2 = (input.rules_version ?? 1) >= 2;
  const path = soilPath(input.soil, input.days, input.initial_storage_frac ?? 1.0, input.et_mm_day ?? RULES.et_mm_day);
  const flags: string[] = [];
  if (path.some((d) => d.estimated)) flags.push("rain_mm_estimated_from_probability");
  if (v2 && input.days.some((d) => d.rain_quality === "spread")) flags.push("rain_spread_evenly");
  if (v2 && input.days.some((d) => d.rain_quality === "inconsistent")) flags.push("rain_window_inconsistent");
  if (path.length === 0) {
    return { verdict: "WAIT", wait_days: null, reasons: ["No forecast data was bought, so no decision can be made."], would_change: "A successful forecast purchase.", confidence: "low", days_to_workable: null, path, config_version: v2 ? CONFIG_VERSION : "0.1.0-placeholder", flags: [...flags, "no_data"] };
  }
  const idx = path.findIndex((d) => d.workable);
  const dtw = idx === -1 ? null : idx;
  const heavy = path.findIndex((d) => d.rain_mm >= RULES.heavy_rain_mm);
  const wet = (d: DayState) => d.rain_mm >= RULES.wet_day_mm;

  let verdict: Decision["verdict"] = "WAIT";
  let wait_days: number | null = null;
  const reasons: string[] = [];
  let would_change = "";

  switch (input.activity) {
    case "field_work": {
      const window = Math.ceil(RULES.fieldwork_dry_hours / 24);
      const soon = path.slice(0, window).find(wet);
      if (soon) { verdict = "AVOID"; reasons.push(`Rain of ${soon.rain_mm} mm is forecast on ${soon.date}, within ${RULES.fieldwork_dry_hours} h.`); would_change = `Forecast rain under ${RULES.wet_day_mm} mm/day for the next ${window} days.`; }
      else if (dtw === 0) { verdict = "GO"; reasons.push("Soil is workable today and no significant rain is forecast in the next 48 h."); would_change = `Any day with ${RULES.wet_day_mm} mm or more in the next ${window} days.`; }
      else if (dtw !== null) { verdict = "WAIT"; wait_days = dtw; reasons.push(`Soil is too wet now; it should be workable on ${path[dtw].date}.`); would_change = "Less rain or a drier start would bring this forward."; }
      else { verdict = "WAIT"; reasons.push("Soil does not reach the workable threshold within the forecast."); would_change = "A longer dry run in the forecast."; }
      break;
    }
    case "harvest": {
      const n = RULES.harvest_dry_run_days;
      let start = -1;
      for (let i = 0; i + n <= path.length; i++) if (path.slice(i, i + n).every((d) => !wet(d))) { start = i; break; }
      if (heavy !== -1 && (start === -1 || heavy < start + n)) { verdict = "AVOID"; reasons.push(`Heavy rain (${path[heavy].rain_mm} mm) is forecast on ${path[heavy].date}.`); }
      else if (start === 0) { verdict = "GO"; reasons.push(`${n} consecutive dry days are forecast from today.`); }
      else if (start > 0) { verdict = "WAIT"; wait_days = start; reasons.push(`The first run of ${n} dry days starts on ${path[start].date}.`); }
      else { verdict = "WAIT"; reasons.push(`No run of ${n} dry days within the forecast.`); }
      would_change = `A run of ${n} days each under ${RULES.wet_day_mm} mm.`;
      break;
    }
    case "mine": {
      const hit = path.findIndex((d) => d.rain_mm > RULES.mine_threshold_mm);
      if (hit === -1) { verdict = "GO"; reasons.push(`No day exceeds ${RULES.mine_threshold_mm} mm in the ${path.length}-day horizon.`); would_change = `Any day above ${RULES.mine_threshold_mm} mm.`; }
      else { verdict = hit === 0 ? "AVOID" : "WAIT"; wait_days = hit; reasons.push(`Days to impact: ${hit}. ${path[hit].rain_mm} mm forecast on ${path[hit].date}. Consider shifting haulage or moving material before then.`); would_change = `That day falling to ${RULES.mine_threshold_mm} mm or less.`; }
      break;
    }
    case "plant": {
      const k = RULES.plant_onset_days;
      let onset = -1;
      for (let i = 0; i + k <= path.length; i++) if (path.slice(i, i + k).reduce((a, d) => a + d.rain_mm, 0) >= RULES.plant_onset_mm) { onset = i + k - 1; break; }
      if (heavy !== -1) { verdict = "AVOID"; reasons.push(`Heavy rain (${path[heavy].rain_mm} mm) is forecast on ${path[heavy].date}; flooding or seed wash-out risk.`); }
      else if (onset === -1) { verdict = "WAIT"; reasons.push(`Onset rule not met: less than ${RULES.plant_onset_mm} mm over any ${k} days in the forecast.`); }
      else {
        const after = path.slice(onset + 1);
        let run = 0, maxRun = 0;
        for (const d of after) { run = wet(d) ? 0 : run + 1; maxRun = Math.max(maxRun, run); }
        if (after.length < RULES.plant_dry_spell_days) flags.push("horizon_too_short_for_dry_spell");
        if (maxRun >= RULES.plant_dry_spell_days) { verdict = "WAIT"; reasons.push(`A dry spell of ${maxRun} days follows the onset rains.`); }
        else if (onset === 0 || (dtw !== null && dtw <= onset)) { verdict = onset === 0 ? "GO" : "WAIT"; wait_days = onset === 0 ? null : onset; reasons.push(`Onset rains (≥${RULES.plant_onset_mm} mm over ${k} days) are met by ${path[onset].date}.`); }
        else { verdict = "WAIT"; wait_days = onset; reasons.push(`Onset is met by ${path[onset].date}.`); }
      }
      would_change = `Total rain over ${k} days crossing ${RULES.plant_onset_mm} mm, or a heavy-rain day (≥${RULES.heavy_rain_mm} mm) appearing.`;
      break;
    }
  }

  let score = 2;
  if (path.length < 3) score--;
  if (flags.includes("rain_mm_estimated_from_probability")) score--;
  if (flags.includes("horizon_too_short_for_dry_spell")) score--;
  if ((input.failed_windows ?? 0) > 0) { score--; flags.push("failed_purchases"); }
  let confidence: Decision["confidence"] = score >= 2 ? "high" : score === 1 ? "medium" : "low";

  if (v2) {
    if (flags.includes("rain_window_inconsistent")) confidence = lower(confidence);
    // A rule that cannot be fully checked never yields a confident answer.
    if (flags.includes("horizon_too_short_for_dry_spell")) {
      confidence = "low";
      reasons.push(`Dry-spell risk beyond day ${path.length} not assessed: the forecast covers ${path.length} days and the rule needs ${RULES.plant_dry_spell_days} after the onset rains.`);
    }
    // Planting and harvest GO must not rest on rain amounts the miners did not state.
    const softRain = flags.some((f) => f === "rain_mm_estimated_from_probability" || f === "rain_spread_evenly" || f === "rain_window_inconsistent");
    if (verdict === "GO" && (input.activity === "plant" || input.activity === "harvest") && softRain) {
      confidence = "low";
      reasons.push("Some rain amounts are estimated, so treat this GO as provisional and check again closer to the day.");
    }
  }

  return { verdict, wait_days, reasons, would_change, confidence, days_to_workable: dtw, path, config_version: v2 ? CONFIG_VERSION : "0.1.0-placeholder", flags };
}

const lower = (c: Decision["confidence"]): Decision["confidence"] => (c === "high" ? "medium" : "low");
