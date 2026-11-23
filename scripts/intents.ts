// Free calls only: forecast intent schema, miners, account, then weather intent search.
import { TelegraphClient, FORECAST_INTENT } from "../packages/telegraph/src/index.ts";

const tg = new TelegraphClient();
const step = async (label: string, fn: () => Promise<unknown>) => {
  const t = Date.now();
  try { console.log(`== ${label} (${Date.now() - t}ms) ==\n`, JSON.stringify(await fn(), null, 2)); }
  catch (e) { console.log(`== ${label} FAILED after ${Date.now() - t}ms: ${(e as Error).message}`); }
};
try {
  await step(FORECAST_INTENT, () => tg.intent(FORECAST_INTENT));
  await step("miners", () => tg.findMiners(FORECAST_INTENT));
  await step("account", () => tg.account());
  await step("weather intents", () => tg.findIntents("weather"));
} finally {
  await tg.close();
}
