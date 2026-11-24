# Workable

**Will the field be workable? The agent buys the forecast; the code does the soil math.**

Workable is an agent for rain-dependent site work: when to plant, when to work or spray a field, when to harvest and dry, and when a mine or quarry should expect rain delays. For a site, it **autonomously buys weather intelligence through [Telegraph](https://hackathon.telegraphprotocol.com/)**, runs a transparent soil-water model in code, and returns **GO, WAIT n days or AVOID**, with the reasons, the cost and the on-chain receipts. After the outcome date it checks the forecast against what actually happened and publishes the error by horizon and the cost per correct decision.

Built for Telegraph Hackathon Season II, Apps & Agents track, **Mission 06: Resources and Agriculture**. This entry is competing for hackathon prizes.

> Status: testnet, early sample, soil parameters are placeholders pending review. Not agronomic advice.

## Do X, see Y

| Do | See |
|---|---|
| Open the hosted demo (no funds) and press **Decide** | A decision card with verdict, reasons, what would change it, the soil-water chart, cost and Telegraph receipts (recorded real purchases) |
| `npm install` then `npm test` | 19 tests pass: soil-bucket invariants, every decision rule, the window-to-daily maths, answer parsing on real receipts, scoreboard maths |
| `npm run decide -- "Ibadan, Nigeria" field_work sandy_loam demo` | The same decision in the terminal, with a decision ID |
| `npm run reproduce -- <decision-id>` (or `-- --all`) | `IDENTICAL`: the engine re-runs from stored inputs and gives the same decision |
| `npm run serve` then open http://localhost:5175 | The full app: demo mode, and **live mode** if a Telegraph key or wallet is configured |
| `npm run outcomes` | Observed weather fetched, decisions judged, `data/scoreboard.json` written; see the **Scoreboard** page |

## Live mode (buys through Telegraph)

1. Get test USDC from the Anjoman faucet and add it to your escrow.
2. Create an Anjoman API key and put it in `.env`: `TELEGRAPH_API_KEY=anjoman_...` (see `.env.example`). A Telegraph wallet (`npx -y @telegraphprotocol/telegraph-protocol-mcp setup`) also works.
3. `npm run decide -- "Kano, Nigeria" harvest loamy_sand live` or use **Live** in `npm run serve`.

A live decision buys `WEATHER_FORECAST_GENERAL` for 24h, 48h, 72h and 120h windows in parallel (about $0.04 on testnet), with no human approving each purchase. Each purchase is saved in `data/receipts/` with miner, cost, time, response hash and the on-chain receipt hash.

`npm run log` buys one 120h forecast for each of the 5 tracked sites (`fixtures/sites.json`) and appends it to `data/forecasts.jsonl`, so the scoreboard keeps growing. Schedule it daily.

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
- **Correctness.** A decision is judged correct if the same engine, fed the weather that actually happened, reaches the same verdict.

## Telegraph integration

| Intent | Use | Status |
|---|---|---|
| `WEATHER_FORECAST_GENERAL` | Core input: rain, rain probability, temperatures by window | Live; 28 miners on testnet |
| `WEATHER_CHECK_*` | Observed weather for scoring | Not used yet; scoring uses Open-Meteo, labelled as not bought through Telegraph |

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
