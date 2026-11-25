// ALL VALUES ARE PLACEHOLDERS pending soil-science review. Bump CONFIG_VERSION on any change.
export const CONFIG_VERSION = "0.2.0-placeholder";
// Units: soil water is millimetres of water held in the top 30 cm (the working / seedbed layer).
// Workability is simplified to "storage at or below a share of field capacity"; in practice, especially for
// clays, it depends on moisture relative to the plastic limit. Values to be checked against standard
// available-water-capacity tables (e.g. FAO-56 Table 19 / USDA texture classes) before they are called reviewed.
export const SOIL_DEPTH_CM = 30;

export type SoilType = "sand" | "loamy_sand" | "sandy_loam" | "loam" | "clay_loam" | "clay";

export interface SoilProfile {
  fc_mm: number;          // storage at field capacity in the working layer
  sat_mm: number;         // storage at saturation
  drain_frac: number;     // share of excess above FC drained per day
  workable_frac: number;  // workable when S <= workable_frac * fc_mm
}

export const SOILS: Record<SoilType, SoilProfile> = {
  sand:       { fc_mm: 25, sat_mm: 45,  drain_frac: 0.9,  workable_frac: 0.95 },
  loamy_sand: { fc_mm: 35, sat_mm: 55,  drain_frac: 0.75, workable_frac: 0.92 },
  sandy_loam: { fc_mm: 45, sat_mm: 65,  drain_frac: 0.6,  workable_frac: 0.9 },
  loam:       { fc_mm: 55, sat_mm: 75,  drain_frac: 0.45, workable_frac: 0.88 },
  clay_loam:  { fc_mm: 65, sat_mm: 85,  drain_frac: 0.3,  workable_frac: 0.85 },
  clay:       { fc_mm: 75, sat_mm: 95,  drain_frac: 0.2,  workable_frac: 0.8 },
};

export const RULES = {
  et_mm_day: 4,                 // default daily evaporation (simplification); sites can override
  wet_day_mm: 2,                // a day with >= this is "rain"
  heavy_rain_mm: 25,            // AVOID threshold
  // When the provider gives only probability: expected mm = pop/100 * this. Flagged as estimated.
  rain_if_wet_mm: 10,
  fieldwork_dry_hours: 48,      // no significant rain in this window
  harvest_dry_run_days: 3,      // consecutive dry days needed
  plant_onset_mm: 20,           // onset rule: >= this over plant_onset_days
  plant_onset_days: 3,
  plant_dry_spell_days: 7,      // a dry run this long after onset is a risk
  mine_threshold_mm: 15,        // haul-road rain delay threshold
};
