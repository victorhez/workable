// Pull numbers out of a forecast answer. Structured fields win; text extraction is flagged.
export interface ParsedForecast {
  temp_max_c: number | null;
  temp_min_c: number | null;
  pop_pct: number | null;
  rain_mm: number | null;
  condition: string | null;
  from_text: string[];      // which fields came from free text, not structured fields
  sources: string[];
  text: string | null;
}

const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && isFinite(+v) ? +v : null);

const RE = {
  temp_max_c: /(?:high of|maximum temperature:?)\s*(-?[\d.]+)\s*°?\s*C/i,
  temp_min_c: /(?:low of|minimum temperature:?)\s*(-?[\d.]+)\s*°?\s*C/i,
  pop_pct: /(?:([\d.]+)\s*% chance of (?:precipitation|rain))|(?:precipitation probability:?\s*([\d.]+)\s*%)/i,
  rain_mm: /(?:precipitation|rain)[^.\n]*?([\d.]+)\s*mm\b/i,
};

export function parseForecastAnswer(resp: any): ParsedForecast {
  const a = resp?.answer;
  const obj = a && typeof a === "object" ? a : resp?.result ?? {};
  const text = typeof a === "string" ? a : typeof resp?.answer?.text === "string" ? resp.answer.text : null;
  const out: ParsedForecast = {
    temp_max_c: num(obj.temp_max_c), temp_min_c: num(obj.temp_min_c),
    pop_pct: num(obj.precipitation_probability_pct), rain_mm: num(obj.precipitation_mm ?? obj.rain_mm),
    condition: typeof obj.condition === "string" ? obj.condition : null,
    from_text: [], sources: [], text,
  };
  if (text) {
    for (const [k, re] of Object.entries(RE) as [keyof typeof RE, RegExp][]) {
      if (out[k] !== null) continue;
      const v = text.match(re)?.slice(1).find((x: string | undefined) => x !== undefined);
      if (v !== undefined) { out[k] = +v; out.from_text.push(k); }
    }
    const cond = text.match(/condition:\s*([^\n]+)/i) ?? text.match(/(?:is|will be)\s+(clear sky|[a-z ]*(?:rain|showers|cloudy|overcast|thunderstorms?|sunny|clear)[a-z ]*?)(?:,|\.| with)/i);
    if (out.condition === null && cond) { out.condition = cond[1].trim(); out.from_text.push("condition"); }
    const last = [...text.matchAll(/(?:^|\n)\s*Sources?:\s*([^\n]+)/gi)].at(-1);
    if (last) out.sources = last[1].replace(/\.$/, "").split(/,\s*/);
  }
  return out;
}
