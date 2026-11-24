# Buy a weather forecast with Telegraph in 10 minutes (TypeScript)

You will write a small TypeScript program that buys a weather forecast from Telegraph's testnet without a human approving the purchase, and saves a receipt. This is the same client Workable uses.

*Disclosure: written for Telegraph Hackathon Season II, which has cash prizes.*

## 1. What you need

- Node 20 or later
- An Anjoman account (free) with test USDC in escrow
- About 10 minutes

## 2. Fund a test account (3 minutes)

1. Sign in at anjoman.ai and open **Dashboard → Faucet**. Claim test USDC (1 USDC per day).
2. Click **Add to escrow**. Telegraph pays miners from escrow, not from your wallet.
3. Create an **API key** in the dashboard. It starts with `anjoman_`.

A forecast costs about $0.01, so 1 test USDC is about 100 forecasts.

## 3. Set up the project (2 minutes)

```bash
mkdir tg-weather && cd tg-weather
npm init -y
npm i @modelcontextprotocol/sdk
npm i -D tsx
```

Create `.env` (never commit it):

```
TELEGRAPH_API_KEY=anjoman_your_key_here
```

## 4. The client (3 minutes)

Telegraph's official MCP server handles payment. We start it as a child process and call its tools from code. Save as `buy.ts`:

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { writeFileSync } from "node:fs";

const client = new Client({ name: "tg-weather", version: "0.1.0" });
await client.connect(new StdioClientTransport({
  command: process.platform === "win32" ? "npx.cmd" : "npx",
  args: ["-y", "@telegraphprotocol/telegraph-protocol-mcp"],
  env: process.env as Record<string, string>,
}));

async function call(name: string, args: Record<string, unknown> = {}) {
  const res: any = await client.callTool({ name, arguments: args }, undefined, { timeout: 180_000 });
  const text = res.content.map((c: any) => c.text ?? "").join("");
  if (res.isError) throw new Error(text);
  return JSON.parse(text);
}

// Free: what does the intent take and return?
const intent = await call("telegraph_intent", { intent: "WEATHER_FORECAST_GENERAL" });
console.log("params:", intent.params.map((p: any) => p.name), "miners:", intent.miners);

// Paid, autonomous: buy a 24-hour forecast.
const answer = await call("telegraph_ask", {
  intent: "WEATHER_FORECAST_GENERAL",
  params: { location: "Lagos, Nigeria", window_hours: 24 },
});
console.log(answer.answer);
console.log("cost:", answer.cost_usd, "receipt:", answer.sources?.[0]?.receiptHash);

writeFileSync(`receipt-${Date.now()}.json`, JSON.stringify(answer, null, 2));
await client.close();
```

## 5. Run it (1 minute, plus the network)

```bash
npx tsx --env-file=.env buy.ts
```

You should see the intent's parameters, a forecast in plain words, a cost of about `0.01`, and an on-chain receipt hash. A JSON receipt is saved next to the script.

A purchase can take 30–90 seconds on testnet. If you get a `504`, try again; check your balance with `call("telegraph_account")`.

## 6. Things I learned

- **Use the exact intent name.** It is `WEATHER_FORECAST_GENERAL`, not `WEATHER_FORECAST`. `telegraph_find_intents` with `{ "search": "weather" }` lists the options.
- **The schema has no rainfall amount.** It returns rain *probability* and temperatures. Some miners write total rainfall (mm) in the answer text; parse it and label it as extracted.
- **Buy several windows for daily values.** Asking for 24h, 48h, 72h and 120h in parallel and taking differences gives you rain per day in code.
- **Keep receipts.** Store the cost, miner and receipt hash with every answer so anyone can check what your app paid for.

## Next

Workable turns these forecasts into GO / WAIT / AVOID decisions for farms and mine sites, and scores itself against observed weather. Code: see the Workable repository.
