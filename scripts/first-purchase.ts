// The required autonomous machine-to-machine purchase: buy a forecast, save the receipt.
// Usage: npm run buy -- "Ibadan, Nigeria" 120
import { TelegraphClient, FORECAST_INTENT } from "../packages/telegraph/src/index.ts";

const location = process.argv[2] ?? "Ibadan, Nigeria";
const window_hours = Number(process.argv[3] ?? 120);

const tg = new TelegraphClient();
try {
  const before = await tg.account();
  console.log("account before:", JSON.stringify(before, null, 2));
  const r = await tg.ask(FORECAST_INTENT, { location, window_hours });
  console.log("receipt:", JSON.stringify({ ...r, response: undefined }, null, 2));
  console.log("answer:", JSON.stringify(r.response.answer, null, 2));
} finally {
  await tg.close();
}
