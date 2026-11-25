# Workable

**Will the field be workable? The agent buys the forecast; the code does the soil math.**

Workable is an agent for rain-dependent site work: when to plant, when to work or spray a field, when to harvest and dry, and when a mine or quarry should expect rain delays. For a site, it **autonomously buys weather intelligence through [Telegraph](https://hackathon.telegraphprotocol.com/)**, runs a transparent soil-water model in code, and returns **GO, WAIT n days or AVOID**, with the reasons, the cost and the on-chain receipts. After the outcome date it checks the forecast against what actually happened and publishes the error by horizon and the cost per correct decision.

Built for Telegraph Hackathon Season II, Apps & Agents track, **Mission 06: Resources and Agriculture**. This entry is competing for hackathon prizes.

**Live demo: https://workable-telegraph.vercel.app** (no funds needed; replays real Telegraph purchases)

> Status: testnet, early sample, soil parameters are placeholders pending review. Not agronomic advice.

## Do X, see Y

| Do | See |
|---|---|
| Open https://workable-telegraph.vercel.app (no funds) and press **Decide** | A decision card with verdict, reasons, what would change it, the soil-water chart, cost and Telegraph receipts (recorded real purchases) |
| `npm install` then `npm test` | 19 tests pass: soil-bucket invariants, every decision rule, the window-to-daily maths, answer parsing on real receipts, scoreboard maths |
| `npm run decide -- "Ibadan, Nigeria" field_work sandy_loam demo` | The same decision in the terminal, with a decision ID |
| `npm run reproduce -- <decision-id>` (or `-- --all`) | `IDENTICAL`: the engine re-runs from stored inputs and gives the same decision |
| `npm run serve` then open http://localhost:5175 | The full app: demo mode, and **live mode** if a Telegraph key or wallet is configured |
| `npm run outcomes` | Observed weather fetched, decisions judged, `data/scoreboard.json` written; see the **Scoreboard** page |
| Open https://workable-telegraph.vercel.app/summary | A plain HTML summary with the current numbers, readable without JavaScript |
| Open https://workable-telegraph.vercel.app/data/index.json | The open JSON data: decisions, receipts, scoreboard, stats, config. Each decision has a stable page at `/d/<id>` |

## Live mode (buys through Telegraph)

1. Get test USDC from the Anjoman faucet and add it to your escrow.
2. Create an Anjoman API key and put it in `.env`: `TELEGRAPH_API_KEY=anjoman_...` (see `.env.example`). A Telegraph wallet (`npx -y @telegraphprotocol/telegraph-protocol-mcp setup`) also works.
3. `npm run decide -- "Kano, Nigeria" harvest loamy_sand live` or use **Live** in `npm run serve`.

A live decision buys `WEATHER_FORECAST_GENERAL` for 24h, 48h, 72h and 120h windows in parallel (about $0.04 on testnet), with no human approving each purchase. Each purchase is saved in `data/receipts/` with miner, cost, time, response hash and the on-chain receipt hash.

`npm run daily` makes one live decision for each of the 12 tracked sites (`fixtures/sites.json`: farms in Nigeria, Ghana, Kenya, Brazil, India, the USA and Argentina, and mines in Jos, Kitwe, Johannesburg and Kalgoorlie), rotating the activity by day, capped at `WORKABLE_DAILY_CAP_USD` (default $0.60) and stopping if escrow runs low. `scripts/daily.ps1` runs it, then `outcomes`, rebuilds and redeploys the demo, and pushes the data; schedule it daily. (`npm run log` still buys one 120h forecast per site if you only want forecast data.)

## How it works

```
Decide ─► Telegraph client (official MCP server over stdio; escrow / API key)
        │    └─ WEATHER_FORECAST_GENERAL × {24, 48, 72, 120} h  → receipts
        ├─► windows → daily rain (differences, in code)          packages/telegraph/src/forecast.ts
        ├─► soil-water bucket + rules (versioned config)         packages/engine/src
        ├─► plain-language message (EN, Pidgin), numbers filled by code
        └─► data/decisions/<id>.json  (inputs, receipts, config version)

outcomes ─► observed weather ─► hindsight re-run ─► scoreboard   scripts/outcomes.ts, scripts/lib/score.ts
```

- **Soil bucket.** Each day: storage + rain − evapotranspiration; a share of the excess above field capacity drains; storage stays between 0 and saturation. The soil is workable when storage is at or below a share of field capacity.
- **Rules.** Field work: workable now and no rain day within 48 h. Harvest: a run of dry days. Planting: an onset-of-rains total, no heavy-rain day, no long dry spell. Mine: days to the first day above the rain threshold.
- **Confidence** is a rule output (horizon length, estimated vs. stated rain, failed purchases), not a model opinion.
- **No invented data.** If a purchase fails, the app says so and lowers confidence. If a miner gives no rainfall amount, rain is estimated from probability and flagged.
- **Verdict held with hindsight weather.** After the outcome date, the same engine is fed the weather that actually happened; if it reaches the same verdict, the verdict *held*. That checks the forecast-to-verdict chain. It is not a field trial and is not a claim of agronomic accuracy.
- **Rain quality.** Each day's rain is tagged *stated* (a miner gave the amount for that day), *spread* (a multi-day total divided evenly), *estimated* (probability × 10 mm) or *inconsistent* (a longer window reported less rain than a shorter one; never used silently). Decisions show an "estimated rain" badge, and a planting or harvest GO that rests on non-stated rain is capped at low confidence.
- **Horizon.** Planting needs a 7-day dry-spell check, but forecasts reach 5 days; planting verdicts say the later dry-spell risk is not assessed, with low confidence.
- **Units.** Soil water is millimetres of water in the top 30 cm. Workability is simplified to a share of field capacity (in clays it really depends on the plastic limit). Evaporation is a fixed default per site, from 1 mm/day (Iowa winter) to 7 mm/day (Kalgoorlie).
- **Rules versions.** Decisions made before Nov 25 used rules v1 and are re-run under v1, so they still reproduce exactly; new decisions carry `rules_version: 2` and config `0.2.0-placeholder`.

## Telegraph integration

| Intent | Use | Status |
|---|---|---|
| `WEATHER_FORECAST_GENERAL` | Core input: rain, rain probability, temperatures by window | Live; 28 miners on testnet |
| `WEATHER_CHECK_*` | Observed weather for scoring | Not used yet; scoring uses [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0, attribution given; production use needs a suitable plan or another source), labelled as not bought through Telegraph |

Findings for the network (also shared with the bounties repository):
- The forecast intent's schema has no rainfall amount field (`precipitation_mm`); several miners put it in the answer text. Decisions about soil need mm, so a structured field would make this intent far more useful to agriculture apps.
- Asks sometimes return HTTP 504 after a long wait and may still be charged; the client retries once and records failures honestly.

## Limits

- Soil parameters and decision thresholds in `packages/engine/src/config.ts` are placeholders pending soil-science review.
- Daily rain for days 4–5 comes from one window total spread evenly over two days.
- Small samples: the scoreboard states its sample size; treat early numbers as indications.
- Testnet only. Not audited. Not agronomic advice.

## Repository

```
packages/engine      soil model, rules, config, decision store, messages, tests
packages/telegraph   Telegraph client (MCP), receipts, answer parser, window→daily maths
apps/web             local server (live + demo) and the front end
scripts/             decide, reproduce, outcomes, log-forecasts, build-site
fixtures/            tracked sites, recorded real forecasts for demo mode
data/                receipts, decisions, logged forecasts, observed weather, scoreboard
docs/                tutorial, updates, commercial summary
```

`npm run build` produces `dist/`, a static site (demo mode runs the same engine in the browser) ready for Vercel or any static host.

## Disclosure

Built for Telegraph Hackathon Season II, which offers cash prizes. Work started November 2026.
