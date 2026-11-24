// npm run decide -- "Ibadan, Nigeria" field_work sandy_loam [live|demo]
import { runDecide, closeClient } from "./lib/service.ts";

const [location = "Ibadan, Nigeria", activity = "field_work", soil = "sandy_loam", mode = "demo"] = process.argv.slice(2);
try {
  const { record, messages } = await runDecide({ location, activity: activity as any, soil: soil as any, mode: mode as any });
  const d = record.decision;
  console.log(`\n${d.verdict}${d.wait_days ? ` ${d.wait_days} day(s)` : ""}  [confidence ${d.confidence}]  id ${record.id}`);
  for (const r of d.reasons) console.log(" -", r);
  console.log(" what would change it:", d.would_change);
  console.log(` cost: $${record.cost_usd.toFixed(2)} (${record.mode})`);
  for (const n of (record.forecast as any).notes ?? []) console.log(" note:", n);
  console.log("\n" + messages.en + "\n" + messages.pcm);
  console.log(`\nReproduce: npm run reproduce -- ${record.id}`);
} finally { await closeClient(); }
