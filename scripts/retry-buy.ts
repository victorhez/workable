import { TelegraphClient, FORECAST_INTENT } from "../packages/telegraph/src/index.ts";
const tg = new TelegraphClient();
const tries: [string, Record<string, unknown>, string?][] = [
  ["routed 24h", { location: "Ibadan, Nigeria", window_hours: 24 }],
  ["skywire 120h", { location: "Ibadan, Nigeria", window_hours: 120 }, "skywire-forecast"],
];
try {
  for (const [label, params, miner] of tries) {
    const t = Date.now();
    try {
      const r = await tg.ask(FORECAST_INTENT, params, miner);
      console.log(`OK ${label} ${Date.now() - t}ms`, JSON.stringify({ ...r, response: undefined }, null, 2));
      console.log("answer:", JSON.stringify(r.response, null, 2).slice(0, 3000));
      break;
    } catch (e) { console.log(`FAIL ${label} ${Date.now() - t}ms: ${(e as Error).message.slice(0, 300)}`); }
  }
  console.log("account after:", JSON.stringify(await tg.account(), null, 2).slice(0, 1500));
} finally { await tg.close(); }
