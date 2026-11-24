// Plain-language messages. Templates only: every number is filled by code from the decision,
// so no language model can introduce a number. (An LLM rewrite layer can be added later; it must
// keep these placeholders and is rejected if it adds digits.)
import type { Decision } from "./index.ts";

export type Lang = "en" | "pcm";

const ACT: Record<string, Record<Lang, string>> = {
  plant: { en: "planting", pcm: "plant" },
  field_work: { en: "field work or spraying", pcm: "work or spray the farm" },
  harvest: { en: "harvest and drying", pcm: "harvest and dry" },
  mine: { en: "haul-road work", pcm: "do haul-road work" },
};

export function message(d: Decision, activity: string, place: string, lang: Lang = "en"): string {
  const a = ACT[activity]?.[lang] ?? activity;
  const w = d.wait_days ?? 0;
  if (lang === "pcm") {
    const head = d.verdict === "GO" ? `E good ${a} for ${place} now.` : d.verdict === "AVOID" ? `No try ${a} for ${place} now. Rain dey come.` : `Wait${w ? ` ${w} day${w > 1 ? "s" : ""}` : " small"} before you go ${a} for ${place}.`;
    return `${head} ${d.reasons[0] ?? ""} (Confidence: ${d.confidence}.) - Workable`;
  }
  const head = d.verdict === "GO" ? `GO: good conditions for ${a} at ${place}.` : d.verdict === "AVOID" ? `AVOID ${a} at ${place} for now.` : `WAIT${w ? ` ${w} day${w > 1 ? "s" : ""}` : ""} before ${a} at ${place}.`;
  return `${head} ${d.reasons[0] ?? ""} What would change it: ${d.would_change} Confidence: ${d.confidence}. - Workable`;
}

export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
