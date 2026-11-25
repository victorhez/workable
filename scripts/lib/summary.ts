// Crawler- and judge-readable summary (plain HTML, no JavaScript needed).
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function summaryBody(stats: any, board: any, decisions: any[]): string {
  const s = board?.summary ?? {};
  const rows = decisions.slice(0, 15).map((d) =>
    `<tr><td><a href="/d/${esc(d.id)}">${esc(d.id)}</a></td><td>${esc(d.location)}</td><td>${esc(d.activity)}</td><td>${esc(d.verdict)}${d.wait_days ? " " + d.wait_days + "d" : ""}</td><td>$${Number(d.cost_usd).toFixed(2)}</td><td>${esc(d.created_at.slice(0, 16).replace("T", " "))}</td></tr>`).join("");
  return `
<h1>Workable: field decisions from rain forecasts</h1>
<p>Workable is an agent for rain-dependent site work: planting, field work and spraying, harvest and drying, and mine or quarry haul-road rain delays. For a site it autonomously buys weather forecasts through Telegraph (intent WEATHER_FORECAST_GENERAL, 24/48/72/120 h windows, testnet), runs a soil-water model in code, and returns GO, WAIT n days or AVOID with reasons, cost and on-chain receipts. After the outcome date, each verdict is re-run on observed weather and published on the scoreboard.</p>
<h2>Current numbers</h2>
<ul>
<li>Decisions stored: ${esc(stats.decisions)} (${esc(stats.live_decisions)} with live purchases), across ${esc(stats.sites)} sites</li>
<li>Forecasts bought through Telegraph: ${esc(stats.purchases)}, total spend $${Number(stats.spend_usd).toFixed(2)} (about $${stats.avg_cost_per_decision_usd ?? "–"} per decision)</li>
<li>Decisions reproduced exactly from stored inputs: ${esc(stats.reproduced)}/${esc(stats.decisions)}</li>
<li>Verdicts that held with hindsight weather: ${esc(s.decisions_correct ?? 0)}/${esc(s.decisions_judged ?? 0)} judged (${esc(s.decisions_pending ?? 0)} pending); forecast windows scored: ${esc(s.forecast_windows_scored ?? 0)}</li>
<li>${esc(s.sample_size_note ?? "")}</li>
</ul>
<h2>Recent decisions</h2>
<table><thead><tr><th>ID</th><th>Site</th><th>Activity</th><th>Verdict</th><th>Cost</th><th>UTC</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Open data (JSON)</h2>
<ul>
<li><a href="/data/index.json">/data/index.json</a>: list of all endpoints</li>
<li><a href="/data/decisions.json">/data/decisions.json</a>, one file per decision at /data/decision/&lt;id&gt;.json</li>
<li><a href="/data/receipts.json">/data/receipts.json</a>: every Telegraph purchase (miner, cost, time, receipt hash)</li>
<li><a href="/data/scoreboard.json">/data/scoreboard.json</a>, <a href="/data/stats.json">/data/stats.json</a>, <a href="/data/config.json">/data/config.json</a></li>
</ul>
<p>Code: <a href="https://github.com/victorhez/workable">github.com/victorhez/workable</a>. Method and limits: soil parameters are placeholders pending review; the scoreboard measures whether a verdict held with hindsight weather, not agronomic accuracy. Observed weather: Open-Meteo.com (CC BY 4.0). Built for Telegraph Hackathon Season II (Apps &amp; Agents, Mission 06), which offers cash prizes.</p>`;
}

export function summaryPage(body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Workable summary</title><meta name="description" content="Workable buys weather forecasts through Telegraph and turns them into GO / WAIT / AVOID field decisions, scored against observed weather.">
<style>:root{--bg:#f6f5ef;--ink:#1d2618;--muted:#5d6857;--line:#dfe3d6;--a:#2f6b3a}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#12160f;--ink:#e8eddf;--muted:#a2ad98;--line:#2e3828;--a:#8fc46b}}:root[data-theme="dark"]{--bg:#12160f;--ink:#e8eddf;--muted:#a2ad98;--line:#2e3828;--a:#8fc46b}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,sans-serif}main{max-width:900px;margin:0 auto;padding:24px 16px}a{color:var(--a)}table{width:100%;border-collapse:collapse;font-size:14px;display:block;overflow-x:auto}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}</style>
</head><body><main>${body}<p><a href="/">Open the app →</a></p></main></body></html>`;
}
