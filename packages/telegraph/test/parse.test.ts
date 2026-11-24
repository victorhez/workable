import { it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { parseForecastAnswer } from "../src/parse.ts";

it("parses the first real receipt (text answer)", () => {
  const f = readdirSync("data/receipts")[0];
  const p = parseForecastAnswer(JSON.parse(readFileSync(`data/receipts/${f}`, "utf8")).response);
  expect(p).toMatchObject({ temp_max_c: 33.4, temp_min_c: 24.1, pop_pct: 0, rain_mm: 0 });
  expect(p.from_text).toContain("rain_mm");
  expect(p.sources).toContain("Open-Meteo");
});

it("prefers structured fields", () => {
  const p = parseForecastAnswer({ answer: { temp_max_c: 30, temp_min_c: 20, precipitation_probability_pct: 40, condition: "showers" } });
  expect(p).toMatchObject({ temp_max_c: 30, pop_pct: 40, rain_mm: null, from_text: [] });
});

it("parses the list-style answer format", () => {
  const text = "The current weather in Mendoza is 19.2 °C (source: Open-Meteo).\n\nOver the next 120 hours, the forecast is:\n- Condition: clear sky\n- Maximum temperature: 32.4 °C\n- Minimum temperature: 15.1 °C\n- Precipitation probability: 67%\n- Total precipitation: 8.1 mm\n- Peak wind: 18.7 km/h\n\nSources: Open-Meteo, MET Norway Locationforecast, NOAA METAR.";
  expect(parseForecastAnswer({ answer: text })).toMatchObject({ temp_max_c: 32.4, temp_min_c: 15.1, pop_pct: 67, rain_mm: 8.1, condition: "clear sky", sources: ["Open-Meteo", "MET Norway Locationforecast", "NOAA METAR"] });
});
