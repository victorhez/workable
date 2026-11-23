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
