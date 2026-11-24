# Workable: submission pack

Fill the bracketed items before posting. Check the rules page for the exact form questions and video length.

## Public updates (3, on separate dates)

### Update 1 (post today)

> Building Workable for @Telegraphprotoc Hackathon Season II (Mission 06, agriculture).
>
> A rain forecast is not a decision. Workable's agent buys the forecast through Telegraph on its own, then a soil-water model in code says GO, WAIT n days or AVOID for planting, field work, harvest or mine haul roads.
>
> First autonomous purchase done: a 24h Ibadan forecast for $0.01, on-chain receipt 0xfdc39170…5cedb.
>
> Disclosure: this is a hackathon entry with cash prizes. #Telegraph

### Update 2 (about Nov 26)

> Workable update: the agent now buys 24/48/72/120h windows in parallel, turns them into daily rain in code, and shows every receipt and its cost on the decision card. [N] decisions stored, 100% reproduced from inputs.
>
> Finding for the network: WEATHER_FORECAST_GENERAL has no rainfall-amount field; soil decisions need mm. [link to bounties issue]
>
> Demo: https://workable-telegraph.vercel.app · Hackathon entry with prizes. @Telegraphprotoc

### Update 3 (Nov 30)

> Workable is submitted to @Telegraphprotoc Season II. Scoreboard: [X/Y] decisions correct against observed weather, cost per correct decision $[Z], error by horizon published, sample size stated. Tutorial: "Buy a weather forecast with Telegraph in 10 minutes". Limits: placeholder soil parameters, small sample, testnet.
>
> https://workable-telegraph.vercel.app https://github.com/victorhez/workable · Hackathon entry with prizes.

## Demo video script (3–4 minutes)

- **0:00** The problem: "12 mm tomorrow" does not tell a farmer whether clay will be workable on Thursday.
- **0:25** Pick Ibadan, field work, sandy loam. Press Decide in **Live** mode. The agent buys 4 forecast windows through Telegraph; show receipts and the $0.04 cost line.
- **1:10** The decision card: verdict, reasons, what would change it, the soil-water chart, the Pidgin message, WhatsApp share.
- **1:50** Scoreboard: forecast vs. observed, error by horizon, cost per correct decision, sample size.
- **2:30** Terminal: `npm run reproduce -- --all` shows IDENTICAL; `npm test` passes. Switch to the mine preset (days to impact).
- **3:15** Limits (placeholder parameters, small sample, testnet) and what is next.

## Commercial summary (draft)

- **Problem.** Rain forecasts are everywhere; decisions are not. Mistimed planting, spraying or harvest wastes seed, labour and days, and nobody checks how good the advice was.
- **Who pays.** Agro-dealers, cooperatives and extension services that need logged, defensible advice for many farmers; commercial farms; mine and quarry operators planning around rain delays; other agents through an API.
- **Pricing.** Per decision: intelligence cost (about $0.04 on testnet) plus margin. Subscription for sites that need a daily watch and alerts.
- **Cost basis.** The scoreboard publishes intelligence cost per decision and per correct decision, so pricing rests on measured numbers.
- **Why Telegraph.** Pay-per-answer intelligence from ranked providers, with receipts, suits low-volume, high-stakes rain decisions; better weather miners make Workable better without code changes.
- **Growth.** More regions and crops, more intents (observed weather, seasonal outlook, growing degree days) as miners appear, an MCP tool so other agents can buy Workable decisions.

## Final checklist

- [ ] Registered on the Season II website; bounties repository starred
- [x] Autonomous purchase works; receipts saved
- [x] Engine tests pass
- [ ] Soil parameters reviewed (owner)
- [ ] Scoreboard has real outcomes with the sample size stated (`npm run outcomes` after Nov 25)
- [ ] Tutorial published (docs/tutorial.md → blog/dev.to/GitHub)
- [ ] Three dated public updates posted with disclosure and @Telegraphprotoc
- [ ] Two or more independent testers recorded
- [ ] Demo video recorded; commercial summary pasted
- [ ] Submitted on the website; confirmation saved before Dec 1, 23:59 UTC
