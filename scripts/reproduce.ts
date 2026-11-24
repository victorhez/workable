// npm run reproduce -- <decision-id>   |   npm run reproduce -- --all
import { listDecisions, loadDecision, reproduce } from "../packages/engine/src/store.ts";

const arg = process.argv[2];
const recs = arg === "--all" || !arg ? listDecisions() : [loadDecision(arg)].filter(Boolean) as ReturnType<typeof listDecisions>;
if (!recs.length) { console.error(arg ? `No decision ${arg}` : "No decisions stored yet."); process.exit(1); }
let same = 0;
for (const rec of recs) {
  const { identical, rerun } = reproduce(rec);
  if (identical) same++;
  console.log(`${rec.id}  stored ${rec.decision.verdict}  rerun ${rerun.verdict}  config ${rec.decision.config_version}  ${identical ? "IDENTICAL" : "DIFFERENT"}`);
}
console.log(`\nReproduced ${same}/${recs.length} (${Math.round((100 * same) / recs.length)}%)`);
process.exit(same === recs.length ? 0 : 1);
