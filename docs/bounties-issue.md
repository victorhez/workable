# Draft issue for github.com/telegraphprotocol/bounties

**Title:** WEATHER_FORECAST_GENERAL: add a structured rainfall amount (mm) field (needed by agriculture apps, Mission 06)

**Body:**

Building Workable for Season II (Apps & Agents, Mission 06): an agent that buys `WEATHER_FORECAST_GENERAL` through Telegraph and turns it into GO / WAIT / AVOID field decisions with a soil-water model. Demo: https://workable-telegraph.vercel.app · Code: https://github.com/victorhez/workable

**Finding 1: no rainfall amount in the schema.**
The intent's answer fields are `temp_max_c`, `temp_min_c`, `precipitation_probability_pct` and `condition`. Soil, planting, spraying, harvest and mine-haul decisions depend on *how much* rain falls (mm), not only the chance of it. Some miners write a total in the answer text (e.g. "Total precipitation: 8.1 mm"), others don't, so apps have to parse free text or estimate mm from probability.

*Proposal:* add an optional scored field `precipitation_mm` (number, unit mm, total over the requested window), and optionally a `daily` array (`date`, `precipitation_mm`, `temp_max_c`, `temp_min_c`) for windows longer than 24 h.

**Finding 2: windows vs. days.**
Answers summarise the whole window. To get rain per day, Workable buys 24/48/72/120 h windows and differences the totals in code, which costs 4 asks per decision. A per-day breakdown would cut that to 1.

**Finding 3: reliability notes (testnet, Nov 24 2026).**
- Some asks returned HTTP 504 after a long wait; one was still charged.
- Key-mode accounts are limited to 3 concurrent jobs (HTTP 429), so parallel window purchases need to be serialised.
- One answer came back as a normal result with `status: "failed"` ("Payment was rejected by the facilitator"); clients should treat that as a failure.

Receipts for all of the above are in `data/receipts/` in the repo.

*Disclosure: Workable is a Season II hackathon entry with cash prizes.*
