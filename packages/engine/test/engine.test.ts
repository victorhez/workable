import { describe, it, expect } from "vitest";
import { decide, soilPath, SOILS, type DayForecast } from "../src/index.ts";

const days = (mm: number[]): DayForecast[] => mm.map((rain_mm, i) => ({ date: `2026-12-0${i + 1}`, rain_mm }));

describe("soil bucket", () => {
  it("stays within [0, saturation] for every soil", () => {
    for (const soil of Object.keys(SOILS) as (keyof typeof SOILS)[]) {
      for (const d of soilPath(soil, days([200, 0, 0, 0, 0, 0, 0]))) {
        expect(d.storage_mm).toBeGreaterThanOrEqual(0);
        expect(d.storage_mm).toBeLessThanOrEqual(SOILS[soil].sat_mm);
      }
    }
  });
  it("dries monotonically with no rain", () => {
    const p = soilPath("clay", days([0, 0, 0, 0, 0]));
    for (let i = 1; i < p.length; i++) expect(p[i].storage_mm).toBeLessThanOrEqual(p[i - 1].storage_mm);
  });
  it("sand becomes workable sooner than clay after rain", () => {
    const f = days([30, 0, 0, 0, 0, 0, 0]);
    const sand = soilPath("sand", f).findIndex((d) => d.workable);
    const clay = soilPath("clay", f).findIndex((d) => d.workable);
    expect(sand).toBeLessThan(clay === -1 ? 99 : clay);
  });
  it("golden: loam, S0=FC, one dry day -> 51 mm", () => {
    expect(soilPath("loam", days([0]))[0].storage_mm).toBe(51); // 55 - 4 ET
  });
  it("estimates mm from probability and flags it", () => {
    const r = decide({ activity: "field_work", soil: "loam", days: [{ date: "2026-12-01", pop_pct: 50 }] });
    expect(r.flags).toContain("rain_mm_estimated_from_probability");
    expect(r.path[0].rain_mm).toBe(5);
  });
});

describe("rules", () => {
  it("field work: AVOID when rain within 48 h", () => {
    expect(decide({ activity: "field_work", soil: "sand", initial_storage_frac: 0.5, days: days([0, 10, 0]) }).verdict).toBe("AVOID");
  });
  it("field work: GO when dry and workable", () => {
    expect(decide({ activity: "field_work", soil: "sand", initial_storage_frac: 0.5, days: days([0, 0, 0]) }).verdict).toBe("GO");
  });
  it("field work: WAIT n days on wet clay", () => {
    const r = decide({ activity: "field_work", soil: "clay", days: days([0, 0, 0, 0, 0, 0, 0]) });
    expect(r.verdict).toBe("WAIT");
    expect(r.wait_days).toBe(r.days_to_workable);
    expect(r.days_to_workable).toBeGreaterThan(0);
  });
  it("harvest: WAIT until dry run", () => {
    const r = decide({ activity: "harvest", soil: "loam", days: days([5, 0, 0, 0]) });
    expect(r).toMatchObject({ verdict: "WAIT", wait_days: 1 });
  });
  it("harvest: AVOID on heavy rain", () => {
    expect(decide({ activity: "harvest", soil: "loam", days: days([0, 30, 0, 0]) }).verdict).toBe("AVOID");
  });
  it("mine: days to impact", () => {
    expect(decide({ activity: "mine", soil: "loam", days: days([0, 0, 20]) })).toMatchObject({ verdict: "WAIT", wait_days: 2 });
    expect(decide({ activity: "mine", soil: "loam", days: days([0, 0, 15]) }).verdict).toBe("GO");
  });
  it("plant: WAIT when onset not met, AVOID on heavy rain", () => {
    expect(decide({ activity: "plant", soil: "loam", days: days([1, 1, 1]) }).verdict).toBe("WAIT");
    expect(decide({ activity: "plant", soil: "loam", days: days([0, 40, 0]) }).verdict).toBe("AVOID");
  });
  it("no data -> WAIT, low confidence", () => {
    expect(decide({ activity: "plant", soil: "loam", days: [] })).toMatchObject({ verdict: "WAIT", confidence: "low" });
  });
  it("is deterministic (reproducible)", () => {
    const i = { activity: "field_work" as const, soil: "clay_loam" as const, days: days([3, 0, 12, 0, 0]) };
    expect(JSON.stringify(decide(i))).toBe(JSON.stringify(decide(i)));
  });
});

describe("v2 rules (review fixes, Nov 25)", () => {
  const plantDays = (mm: (number | null)[], q?: string[]) => mm.map((rain_mm, i) => ({ date: `2026-12-0${i + 1}`, rain_mm, pop_pct: rain_mm === null ? 30 : null, rain_quality: (q?.[i] ?? (rain_mm === null ? "estimated" : "stated")) as any }));

  it("planting: a 5-day horizon cannot check the 7-day dry spell, so confidence is low and the limit is stated", () => {
    const r = decide({ activity: "plant", soil: "sandy_loam", initial_storage_frac: 0.7, rules_version: 2, days: plantDays([8, 8, 8, 3, 3]) });
    expect(r.flags).toContain("horizon_too_short_for_dry_spell");
    expect(r.confidence).toBe("low");
    expect(r.reasons.join(" ")).toMatch(/Dry-spell risk beyond day 5 not assessed/);
  });

  it("harvest GO built on estimated rain is never confident", () => {
    const r = decide({ activity: "harvest", soil: "loam", rules_version: 2, days: plantDays([null, null, null, null, null]).map((d) => ({ ...d, pop_pct: 0 })) });
    expect(r.verdict).toBe("GO");
    expect(r.confidence).toBe("low");
    expect(r.reasons.join(" ")).toMatch(/provisional/);
  });

  it("harvest GO on stated rain keeps its confidence", () => {
    const r = decide({ activity: "harvest", soil: "loam", rules_version: 2, days: plantDays([0, 0, 0, 0, 0]) });
    expect(r).toMatchObject({ verdict: "GO", confidence: "high" });
  });

  it("spread rain is flagged", () => {
    const r = decide({ activity: "field_work", soil: "sand", rules_version: 2, days: plantDays([0, 0, 0, 1, 1], ["stated", "stated", "stated", "spread", "spread"]) });
    expect(r.flags).toContain("rain_spread_evenly");
  });

  it("site evaporation changes drying speed", () => {
    const base = { activity: "field_work" as const, soil: "clay" as const, rules_version: 2, days: plantDays([0, 0, 0, 0, 0]) };
    const hot = decide({ ...base, et_mm_day: 7 }), cold = decide({ ...base, et_mm_day: 1 });
    expect(hot.path[4].storage_mm).toBeLessThan(cold.path[4].storage_mm);
  });

  it("v1 inputs keep v1 behaviour (old records reproduce)", () => {
    const days = [{ date: "2026-12-01", pop_pct: 0 }, { date: "2026-12-02", pop_pct: 0 }, { date: "2026-12-03", pop_pct: 0 }];
    const r = decide({ activity: "harvest", soil: "loam", days });
    expect(r.config_version).toBe("0.1.0-placeholder");
    expect(r.reasons.join(" ")).not.toMatch(/provisional/);
    expect(r.path[0]).not.toHaveProperty("quality");
  });
});
